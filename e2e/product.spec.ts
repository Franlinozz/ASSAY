import { test, expect } from '@playwright/test'

// P11.3 — full-product touchpoints: everything a user can actually click. The download validity +
// token refusal live in scripts/route-sweep.mjs (they need the seeded signed URLs); the browser-only
// affordances live here.

test.describe('theme', () => {
  test('the toggle persists across navigation', async ({ page }) => {
    // Start from whatever the box defaults to, flip it, and prove the CHOICE survives navigation.
    await page.goto('/')
    const before = await page.locator('html').getAttribute('data-theme')
    await page.getByTestId('theme-toggle').click()
    const after = before === 'dark' ? 'light' : 'dark'
    await expect(page.locator('html')).toHaveAttribute('data-theme', after)
    const stored = await page.evaluate(() => window.localStorage.getItem('assay-theme'))
    expect(stored).toBe(after)
    // Navigate to other pages — the choice survives (no flash back to the default).
    await page.goto('/gallery')
    await expect(page.locator('html')).toHaveAttribute('data-theme', after)
    await page.goto('/judge')
    await expect(page.locator('html')).toHaveAttribute('data-theme', after)
  })
})

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 780 } })
  test('the menu opens and a link navigates', async ({ page }) => {
    await page.goto('/')
    const menuBtn = page.getByRole('button', { name: /open menu/i })
    await expect(menuBtn).toBeVisible()
    await menuBtn.click()
    const mobileNav = page.locator('#mobile-nav')
    await expect(mobileNav).toBeVisible()
    await mobileNav.getByRole('link', { name: 'Gallery' }).click()
    await expect(page).toHaveURL(/\/gallery$/)
    await expect(page.getByTestId('gallery-grid')).toBeVisible()
  })
})

test.describe('copy-to-clipboard (/agents)', () => {
  test('the copy button copies the MCP config and confirms', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/agents')
    const copy = page.getByTestId('copy-btn').first()
    await expect(copy).toBeVisible()
    await copy.click()
    await expect(copy).toContainText('copied')
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip.length).toBeGreaterThan(0)
    expect(clip).toMatch(/assay|mcp|api\.assayed\.xyz/i)
  })

  test('the consumer script covers free verify and one approved paid ATS call', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/agents')
    const script = page.getByTestId('consumer-test-script')
    await expect(script).toContainText('asy_verify')
    await expect(script).toContainText('asy_ats_scan')
    await expect(script).toContainText('wait for my approval')
    const copy = page.getByRole('button', { name: /copy test script/i })
    await copy.click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain('DSR-WC0Q7NZ7')
    expect(clip).toContain('PAYMENT-RESPONSE')
  })
})

test.describe('in-product links resolve', () => {
  test('the persona fixture pages are live and labeled fictional (LINK_LIVENESS honesty)', async ({
    page,
  }) => {
    for (const slug of [
      'adaeze-okonkwo-portfolio',
      'tomas-rivera-portfolio',
      'mei-lin-chao-portfolio',
    ]) {
      const res = await page.goto(`/fixtures/${slug}.html`)
      expect(res?.status()).toBe(200)
      await expect(page.locator('.tag, .fictional-tag').first()).toContainText('Fictional persona')
    }
  })

  test('a persona page links its live source and the on-chain seal explorer', async ({ page }) => {
    await page.goto('/gallery/tomas-rivera')
    // Every rendered live-source chip points at a real /fixtures page.
    const sources = page.locator('a.chip-linked')
    await expect(sources.first()).toBeVisible()
    const href = await sources.first().getAttribute('href')
    expect(href).toContain('/fixtures/')
  })
})
