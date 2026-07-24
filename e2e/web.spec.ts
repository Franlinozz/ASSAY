import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
import { STANDARD, STANDARD_MARKDOWN } from '../apps/web/lib/standard.generated'

// P8 e2e — runs on the fake-mode stack (global-setup seeds a real dossier through the pipeline).

const PAGES = ['/', '/standard', '/evaluation', '/pricing', '/agents', '/verify', '/gallery']

function seededDossierId(): string {
  const state = JSON.parse(readFileSync(resolve(HERE, '.stack-state.json'), 'utf8')) as {
    dossierId: string
  }
  return state.dossierId
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((t) => window.localStorage.setItem('assay-theme', t), theme)
}

test.describe('landing', () => {
  test('renders in light theme with the hero and honesty line', async ({ page }) => {
    await setTheme(page, 'light')
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.getByRole('heading', { name: 'Proof before polish.' })).toBeVisible()
    await expect(page.getByTestId('integrity-line')).toContainText(
      'A seal proves the artifact is unchanged — not that a claim is objectively true.',
    )
    await expect(page.getByTestId('sealed-strip')).toBeVisible()
  })

  test('renders in dark theme and the toggle flips back', async ({ page }) => {
    await setTheme(page, 'dark')
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(bgDark).not.toBe(bgLight)
  })

  test('hero evidence-threads interaction fires', async ({ page }) => {
    await page.goto('/')
    const threads = page.getByTestId('evidence-threads')
    await expect(threads).toBeVisible()
    // idle: no taut thread, nothing lit
    expect(await threads.locator('[data-thread="taut"]').count()).toBe(0)
    await threads.locator('button').nth(1).hover()
    await expect(threads).toHaveAttribute('data-active-bullet', /b1/)
    await expect
      .poll(async () => threads.locator('[data-thread="taut"]').count())
      .toBeGreaterThan(0)
    expect(await threads.locator('[data-lit]').count()).toBeGreaterThan(0)
  })

  test('live seal strip shows the seeded dossier', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('sealed-strip')).toContainText('DSR-', { timeout: 15_000 })
    await expect(page.getByTestId('sealed-strip')).toContainText('AS-1.0.0')
  })
})

test.describe('the published standard (guardrail #2)', () => {
  test('page content matches renderStandardMarkdown exactly', async ({ page }) => {
    await page.goto('/standard')
    const body = await page.locator('main').innerText()

    // The generated markdown IS the grader's own rendering — assert every hard check id, title
    // and description, every craft axis + weight, and the exact pass-rule numbers appear.
    expect(STANDARD_MARKDOWN).toContain('The standard does not bend for our own marketing.')
    await expect(page.getByTestId('standard-motto')).toContainText(
      'The standard does not bend for our own marketing.',
    )
    for (const check of STANDARD.hardChecks) {
      expect(body).toContain(check.id)
      expect(body).toContain(check.title)
      expect(body.replace(/\s+/g, ' ')).toContain(check.description.replace(/\s+/g, ' '))
    }
    for (const axis of STANDARD.craftAxes) {
      expect(body).toContain(axis.title)
      expect(body).toContain(axis.description)
    }
    expect(body).toContain(`≥ ${STANDARD.craftPassMean}`)
    expect(body).toContain(`≥ ${STANDARD.craftAxisFloor}`)
    expect(body).toContain(String(STANDARD.repairLimit))
    expect(body).toContain(STANDARD.version)
  })
})

test.describe('verify', () => {
  test('round-trips the seeded sealed dossier', async ({ page }) => {
    const dossierId = seededDossierId()
    await page.goto('/verify')
    await page.getByTestId('verify-input').fill(dossierId)
    await page.getByTestId('verify-submit').click()
    const result = page.getByTestId('verify-result')
    await expect(result).toBeVisible({ timeout: 30_000 })
    // The stack has no sealer key and never anchors — the honest state is 'pending', with the
    // real commitment leaf computed from the stored dossier + salt.
    await expect(result).toHaveAttribute('data-status', 'pending')
    await expect(result).toContainText('0x')
    await expect(result).toContainText('Registry')
  })

  test('a bogus reference reports not found honestly', async ({ page }) => {
    await page.goto('/verify')
    await page.getByTestId('verify-input').fill('DSR-DOESNOTEXIST')
    await page.getByTestId('verify-submit').click()
    const result = page.getByTestId('verify-result')
    await expect(result).toBeVisible({ timeout: 30_000 })
    await expect(result).toHaveAttribute('data-status', /not-found|unavailable/)
  })
})

test.describe('accessibility (axe)', () => {
  for (const path of PAGES) {
    test(`${path} has no serious violations`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).analyze()
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      )
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([])
    })
  }
})

test.describe('no raw gap or error strings (guardrail #9)', () => {
  const RAW_PATTERNS = [
    />\s*undefined\s*</,
    /\[object Object\]/,
    /\bNaN\b/,
    /provider:unavailable/,
    /chain:rpc/,
    /ECONNREFUSED/,
    /stack trace/i,
  ]
  // Placeholder words are themselves banned copy — except on /standard, where the published
  // PLACEHOLDER_TEXT law legitimately names them.
  const PLACEHOLDER_PATTERNS = [/\blorem\b/i, /\bTBD\b/, /YOUR [A-Z]+ HERE/]
  for (const path of PAGES) {
    test(`${path} HTML is clean`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const html = await page.content()
      for (const pattern of RAW_PATTERNS) {
        expect(html).not.toMatch(pattern)
      }
      if (path !== '/standard') {
        for (const pattern of PLACEHOLDER_PATTERNS) {
          expect(html).not.toMatch(pattern)
        }
      }
    })
  }
})
