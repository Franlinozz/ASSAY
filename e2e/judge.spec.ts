import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// P10 e2e — the judge tour + sealed gallery personas. Runs on the fake-mode stack, but the persona
// seals were anchored on X Layer MAINNET at build time, so /verify confirms them against the real
// chain (the mcp-server's asy_verify reads mainnet regardless of provider mode).

interface Persona {
  slug: string
  name: string
  seal: { leaf: string; status: string }
}
const personas = (
  JSON.parse(
    readFileSync(resolve(HERE, '../apps/web/lib/personas.generated.json'), 'utf8'),
  ) as { personas: Persona[] }
).personas

test.describe('gallery personas (guardrail #7)', () => {
  test('gallery lists all personas with a featured one, no duplicates', async ({ page }) => {
    await page.goto('/gallery')
    const grid = page.getByTestId('gallery-grid')
    await expect(grid).toBeVisible()
    for (const p of personas) {
      await expect(page.getByTestId(`persona-card-${p.slug}`)).toBeVisible()
    }
    // exactly one featured card
    expect(await grid.locator('[data-featured="true"]').count()).toBe(1)
    // no duplicate cards
    expect(await grid.getByTestId(/persona-card-/).count()).toBe(personas.length)
  })

  test('every persona page carries the fictional tag and its real dossier', async ({ page }) => {
    for (const p of personas) {
      await page.goto(`/gallery/${p.slug}`)
      await expect(page.locator('.fictional-tag').first()).toContainText('Fictional persona')
      await expect(page.getByRole('heading', { name: p.name })).toBeVisible()
      await expect(page.getByTestId('persona-dossier-id')).toContainText('DSR-')
      // seal receipt shows the on-chain leaf + sealed status
      const seal = page.getByTestId('persona-seal')
      await expect(seal).toContainText(p.seal.leaf)
      // coverage map is present (gaps are shown, not hidden)
      await expect(page.getByTestId('persona-coverage')).toBeVisible()
    }
  })

  test('the featured persona shows a held-back (blocked) claim', async ({ page }) => {
    await page.goto('/gallery/adaeze-okonkwo')
    await expect(page.getByTestId('persona-questions')).toContainText('pending your confirmation')
  })
})

test.describe('the seals verify on-chain against mainnet', () => {
  for (const p of personas) {
    test(`${p.slug} seal verifies as sealed`, async ({ page }) => {
      await page.goto(`/verify?leaf=${p.seal.leaf}`)
      const result = page.getByTestId('verify-result')
      await expect(result).toBeVisible({ timeout: 30_000 })
      await expect(result).toHaveAttribute('data-status', 'sealed')
      await expect(result).toContainText(p.seal.leaf)
    })
  }

  test('the persona verify link deep-links and confirms', async ({ page }) => {
    await page.goto('/gallery/adaeze-okonkwo')
    await page.getByTestId('persona-verify-link').click()
    const result = page.getByTestId('verify-result')
    await expect(result).toBeVisible({ timeout: 30_000 })
    await expect(result).toHaveAttribute('data-status', 'sealed')
  })
})

test.describe('judge mode', () => {
  test('landing has the 90-second CTA into /judge', async ({ page }) => {
    await page.goto('/')
    const cta = page.getByRole('link', { name: 'Watch the 90-second run' })
    await expect(cta).toBeVisible()
    await cta.click()
    await expect(page).toHaveURL(/\/judge$/)
    await expect(page.getByTestId('judge-tour')).toBeVisible()
  })

  test('the replay caption is always present (honesty)', async ({ page }) => {
    await page.goto('/judge')
    await expect(page.getByTestId('judge-replay-caption')).toContainText('Replaying a sealed run')
  })

  test('the tour is skippable and reaches every beat including the honesty + seal beats', async ({
    page,
  }) => {
    await page.goto('/judge')
    const tour = page.getByTestId('judge-tour')
    await expect(tour).toBeVisible()
    // Pause autoplay, then step through with Skip so the walk is deterministic.
    await page.getByTestId('judge-playpause').click()

    const seenBeats = new Set<string>()
    for (let i = 0; i < 20; i++) {
      seenBeats.add((await tour.getAttribute('data-beat')) ?? '')
      const skip = page.getByTestId('judge-skip')
      if (await skip.isDisabled()) break
      await skip.click()
    }
    // The honesty beat (a blocked claim) and the seal stamp must both appear.
    expect(seenBeats.has('blocked')).toBeTruthy()
    expect(seenBeats.has('seal')).toBeTruthy()
    expect(seenBeats.has('verify')).toBeTruthy()
  })

  test('the blocked (honesty) beat renders a real held-back claim', async ({ page }) => {
    await page.goto('/judge')
    await page.getByTestId('judge-playpause').click()
    // Skip to the blocked beat.
    const tour = page.getByTestId('judge-tour')
    for (let i = 0; i < 20; i++) {
      if ((await tour.getAttribute('data-beat')) === 'blocked') break
      await page.getByTestId('judge-skip').click()
    }
    await expect(page.getByTestId('judge-blocked')).toContainText('BLOCKED')
  })

  test('the seal beat shows the vermilion SEAL stamp with the real leaf', async ({ page }) => {
    await page.goto('/judge')
    await page.getByTestId('judge-playpause').click()
    const tour = page.getByTestId('judge-tour')
    for (let i = 0; i < 20; i++) {
      if ((await tour.getAttribute('data-beat')) === 'seal') break
      await page.getByTestId('judge-skip').click()
    }
    await expect(page.getByTestId('judge-seal-stamp')).toBeVisible()
    await expect(tour).toContainText(personas[0].seal.leaf.slice(0, 20))
  })

  test('the verify beat confirms live on-chain (and has a cached fallback)', async ({ page }) => {
    await page.goto('/judge')
    await page.getByTestId('judge-playpause').click()
    const tour = page.getByTestId('judge-tour')
    for (let i = 0; i < 20; i++) {
      if ((await tour.getAttribute('data-beat')) === 'verify') break
      await page.getByTestId('judge-skip').click()
    }
    const verify = page.getByTestId('judge-verify')
    await expect(verify).toBeVisible()
    // Either the live read confirms it, or the cached fallback shows the sealed run — never a crash.
    await expect(verify).toContainText(/Confirmed live on X Layer|cached result|Reading the chain/, {
      timeout: 20_000,
    })
    await expect(verify).toContainText('sealed')
  })
})
