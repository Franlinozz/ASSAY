import { defineConfig } from '@playwright/test'

// E2e runs against the fake-mode stack (e2e/global-setup.ts boots mcp-server + the built web app
// and seeds one dossier — zero spend, no chain writes). Chromium only: the VPS and CI both have it.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  reporter: 'list',
  timeout: 60_000,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:3400',
    screenshot: 'only-on-failure',
  },
})
