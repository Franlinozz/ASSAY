import { test, expect, type Page } from '@playwright/test'

// P9 full-flow e2e on the fake-mode stack (ASY_STUDIO_REAL_PDF + ASY_FAKE_REPAIR_DEMO set by the
// stack): create → ingest → confirm (incl. answering a needs_confirmation) → brief (one honest
// missing) → forge → evidence drawer → tribunal report incl. a first-draft fail → seal → share →
// verify → revoke → withdrawn. Plus token security.

const FIXTURE_RESUME = [
  'Chidinma Eze — Senior Backend Engineer, Lagos. chidinma.eze@example.com.',
  'EXPERIENCE',
  'Paystack — Senior Backend Engineer (Mar 2021 – Present):',
  'Reduced API p95 latency by 38% by introducing PostgreSQL connection pooling.',
  'Scaled the payments service to 12000 requests per second during peak sales.',
  'Andela — Backend Engineer (Jun 2018 – Feb 2021):',
  'Mentored 5 junior engineers and led the migration to TypeScript.',
  'SKILLS TypeScript, Node.js, PostgreSQL, Redis, Kubernetes',
].join('\n')

const FIXTURE_JD = [
  '- PostgreSQL connection pooling and latency tuning experience is required',
  '- Must have scaled a payments service to thousands of requests per second',
  '- Rust systems programming experience is required',
  '- Mentored junior engineers or led a team migration',
].join('\n')

async function createDossier(page: Page): Promise<void> {
  await page.goto('/studio')
  await expect(page.getByText('Interview.')).toBeVisible()
  await page.getByTestId('start-name').fill('Chidinma Eze')
  await page.getByTestId('start-email').fill('chidinma.eze@example.com')
  await page.getByTestId('start-submit').click()
  await page.waitForURL(/\/d\/DSR-[A-Z0-9]+\?t=/, { timeout: 20_000 })
  await expect(page.getByText('stage 1 / 5')).toBeVisible()
}

test.describe('token security', () => {
  test('a dossier page without its token shows the missing-key state (no data)', async ({
    page,
  }) => {
    await createDossier(page)
    const url = new URL(page.url())
    const id = url.pathname.split('/d/')[1]!
    await page.goto(`/d/${id}`) // no ?t=
    await expect(page.getByText('missing its capability key', { exact: false })).toBeVisible()
    // The mutation API itself refuses without a token.
    const res = await page.request.post(`/api/asy/d/${id}/brief`, { data: { jd: 'x' } })
    expect(res.status()).toBe(403)
  })
})

test.describe('the full dossier flow', () => {
  test('create → confirm → brief → forge → drawer → report(fail) → seal → share → verify → revoke', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await createDossier(page)

    // ── LEDGER: ingest the fixture résumé ──
    await page.getByRole('tab', { name: 'Paste text' }).click()
    await page.getByTestId('intake-text').fill(FIXTURE_RESUME)
    await page.getByRole('button', { name: 'Read it' }).click()
    await page.waitForSelector('[data-testid=claim-card]', { timeout: 40_000 })

    // Answer the one needs_confirmation card (the demo fixture's unsourced figure).
    const needsCard = page.locator('[data-status=needs_confirmation]').first()
    if (await needsCard.count()) {
      await needsCard.getByTestId('claim-answer').fill('8 — from my 2023 team roster')
      await needsCard.getByTestId('claim-confirm').click()
      await page.waitForTimeout(500)
    }
    // Confirm every remaining extracted claim.
    for (let i = 0; i < 12; i++) {
      const btns = page.getByTestId('claim-confirm')
      if ((await btns.count()) === 0) break
      await btns.first().click()
      await page.waitForTimeout(400)
    }
    await expect(page.getByTestId('ledger-progress')).toContainText('/')

    // ── BRIEF: paste the JD, expect one honest 'missing' (Rust) ──
    await page.getByTestId('to-brief').click()
    await page.getByTestId('brief-mode-promotion').click()
    await expect(page.getByTestId('promotion-range')).toBeVisible()
    await page.getByTestId('brief-mode-freelance').click()
    await expect(page.getByTestId('project-claims')).toBeVisible()
    await page.getByTestId('brief-mode-job').click()
    await page.getByTestId('brief-jd').fill(FIXTURE_JD)
    await page.getByTestId('brief-submit').click()
    await page.waitForSelector('[data-testid=coverage-map]', { timeout: 25_000 })
    await expect(
      page.locator('[data-testid=coverage-row][data-status=missing]').first(),
    ).toBeVisible()

    // ── INTERVIEW ROOM: both themes + planted ledger contradiction ──
    await page.getByTestId('to-forge').click()
    await page.getByTestId('prepare-interview').click()
    await expect(page.getByTestId('interview-room')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('brief-mode-promotion')).toHaveCount(0) // modes live in Brief, not hidden here
    const initialTheme = await page.locator('html').getAttribute('data-theme')
    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', initialTheme ?? 'light')
    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', initialTheme ?? 'light')

    const firstAnswer = page.getByTestId('interview-answer-0')
    await firstAnswer.fill(
      'The situation was a latency incident. My task was recovery. I reduced latency by 39% and the result was a stable service.',
    )
    await page.getByRole('button', { name: 'Check this answer' }).first().click()
    await expect(page.getByTestId('interview-contradiction')).toBeVisible({ timeout: 20_000 })
    await firstAnswer.fill(
      'The situation was a latency incident. My task was recovery. I reduced latency by 38% and the result was a stable service.',
    )
    await page.getByRole('button', { name: 'Check this answer' }).first().click()
    await expect(page.getByText('final answer · stored with evidence chips')).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('button', { name: 'Continue to the Forge' }).click()
    await expect(page.getByText('Stage 4 · the Forge')).toBeVisible()

    // ── FORGE ──
    await page.getByTestId('run-forge').click()
    // Two real chromium PDF renders; give headroom on a shared/loaded box (parallel e2e workers).
    await page.waitForSelector('[data-testid=forge-result]', { timeout: 180_000 })

    // Evidence drawer: hovering a sentence pulls a taut thread to its proof.
    const drawer = page.getByTestId('evidence-drawer')
    await expect(drawer).toBeVisible()
    await drawer.locator('button').first().hover()
    await expect
      .poll(async () => drawer.locator('[data-thread="taut"]').count(), { timeout: 5_000 })
      .toBeGreaterThan(0)

    // ── REPORT: a first-draft fail must be present (the repair demo) ──
    await page.getByTestId('to-report').click()
    await page.waitForSelector('[data-testid=report-rollup]', { timeout: 15_000 })
    await expect(page.getByText('Stage 5 · the Report')).toBeVisible()
    await expect(page.getByTestId('gallery-privacy-note')).toContainText(
      'never appears in the public Gallery automatically',
    )
    await expect(page.locator('.verdict-fail').first()).toBeVisible()
    await expect(page.locator('.repair-brief').first()).toBeVisible()

    // ── SEAL (unsigned dev mode) ──
    await page.getByTestId('seal-button').click()
    await expect(page.getByTestId('seal-receipt')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('seal-receipt')).toContainText('0x')

    // ── SHARE ──
    await page.getByTestId('issue-share').click()
    await expect(page.getByTestId('share-link')).toBeVisible({ timeout: 15_000 })
    const shareHref = await page.getByTestId('share-link').locator('a').getAttribute('href')
    expect(shareHref).toMatch(/\/s\/s_/)

    // ── RECRUITER PORTAL: threads + live verify ──
    const portal = await page.context().newPage()
    await portal.goto(shareHref!)
    await expect(portal.getByTestId('recruiter-threads')).toBeVisible()
    await portal.getByTestId('recruiter-verify').click()
    await expect(portal.getByTestId('recruiter-verify-result')).toBeVisible({ timeout: 20_000 })

    // ── REVOKE → withdrawn ──
    await page.getByTestId('revoke-share').click()
    await expect(page.getByTestId('share-revoked')).toBeVisible({ timeout: 10_000 })
    await portal.goto(shareHref!)
    await expect(portal.locator('.withdrawn')).toBeVisible()
    await expect(portal.getByText('withdrawn by the candidate', { exact: false })).toBeVisible()
    await portal.close()
  })
})

test('the /judge tour renders (full coverage in judge.spec.ts)', async ({ page }) => {
  await page.goto('/judge')
  await expect(page.getByTestId('judge-tour')).toBeVisible()
})
