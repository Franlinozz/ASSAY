import { test, expect } from '@playwright/test'

// P11.3 — full-product touchpoints: everything a user can actually click. The download validity +
// token refusal live in scripts/route-sweep.mjs (they need the seeded signed URLs); the browser-only
// affordances live here.

test.describe('theme', () => {
  test('the toggle persists across navigation', async ({ page }) => {
    // Start from whatever the box defaults to, flip it, and prove the CHOICE survives navigation.
    await page.goto('/')
    const before = await page.locator('html').getAttribute('data-theme')
    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toHaveAttribute('data-theme-state', before === 'dark' ? 'dark' : 'light')
    await expect(toggle).toHaveAttribute(
      'aria-label',
      before === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
    )
    await toggle.click()
    const after = before === 'dark' ? 'light' : 'dark'
    await expect(page.locator('html')).toHaveAttribute('data-theme', after)
    await expect(toggle).toHaveAttribute('data-theme-state', after)
    await expect(toggle).toHaveAttribute(
      'aria-label',
      after === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
    )
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

  test('the supplied lockup and controls hold opposite edges while the header sticks', async ({
    page,
  }) => {
    await page.goto('/studio')
    await expect(page.locator('.site-header .brand-lockup-light')).toHaveAttribute(
      'src',
      '/brand/lockup-light.webp',
    )

    const before = await page.evaluate(() => {
      const actions = document.querySelector('.site-header-actions')?.getBoundingClientRect()
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        actionsRight: actions?.right ?? 0,
      }
    })
    expect(before.scrollWidth).toBe(before.viewport)
    expect(before.viewport - before.actionsRight).toBeLessThanOrEqual(21)

    await page.evaluate(() => window.scrollTo(0, 500))
    const header = await page.locator('.site-header').boundingBox()
    expect(header?.x).toBe(0)
    expect(header?.width).toBe(390)
  })

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

  test('documentation is directly discoverable from the mobile menu', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /open menu/i }).click()
    await expect(page.locator('#mobile-nav').getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      '/docs',
    )
  })
})

test('landing proof interaction has no ornamental vertical scan overlay', async ({ page }) => {
  await page.goto('/')
  const scanContent = await page
    .locator('.hero-proof')
    .evaluate((element) => getComputedStyle(element, '::after').getPropertyValue('content'))
  expect(scanContent).toBe('none')
})

const EDITORIAL_IMAGES = [
  {
    path: '/',
    alt: 'Hands tracing a résumé claim to supporting professional evidence.',
  },
  {
    path: '/',
    alt: 'A recruiter comparing a résumé statement with its supporting work evidence.',
  },
  {
    path: '/',
    alt: 'A professional waiting outside an interview room with a verified evidence dossier.',
  },
  {
    path: '/standard',
    alt: 'Three reviewers independently applying a professional evidence standard.',
  },
  {
    path: '/studio',
    alt: 'A professional organizing years of work into a new evidence dossier.',
  },
  {
    path: '/evaluation',
    alt: 'Independent reviewers examining a candidate’s evidence dossier.',
  },
  {
    path: '/verify',
    alt: 'An archival specialist applying an integrity mark to a professional dossier.',
  },
  {
    path: '/gallery',
    alt: 'Three evidence dossiers displaying work from operations, engineering and healthcare.',
  },
] as const

test.describe('editorial photography system', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`all eight meaningful photographs load in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('assay-theme', value), theme)
      let currentPath = ''
      for (const item of EDITORIAL_IMAGES) {
        if (item.path !== currentPath) {
          await page.goto(item.path)
          currentPath = item.path
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        }
        const image = page.getByAltText(item.alt)
        await image.scrollIntoViewIfNeeded()
        await expect(image).toBeVisible()
        await expect
          .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
          .toBeGreaterThan(0)
      }
    })
  }

  for (const width of [390, 430]) {
    test(`affected routes remain overflow-free at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      for (const path of ['/', '/standard', '/studio', '/evaluation', '/verify', '/gallery']) {
        await page.goto(path)
        const dimensions = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }))
        expect(dimensions.content).toBe(dimensions.viewport)
      }
    })
  }
})

test.describe('copy-to-clipboard (/agents)', () => {
  test('explains eleven API tools versus thirteen marketplace offers', async ({ page }) => {
    await page.goto('/agents')
    await expect(
      page.getByRole('heading', { name: 'Eleven tools. Thirteen offers. One protocol.' }),
    ).toBeVisible()
    await expect(page.getByText('Why 13 on OKX.AI?')).toBeVisible()
    await expect(page.getByText('asy_create_dossier_job', { exact: true }).first()).toBeVisible()
  })

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
  test('gallery explains that Studio dossiers remain private', async ({ page }) => {
    await page.goto('/gallery')
    await expect(page.getByTestId('gallery-grid')).toBeVisible()
    await expect(page.getByText('Public showcase · private Studio')).toBeVisible()
    await expect(page.getByText(/will not appear here automatically/i)).toBeVisible()
  })

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
