import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Internal packages resolve to their TS source in tests (no build step needed).
const src = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@xyndicate/assay-core': src('./packages/assay-core/src/index.ts'),
      '@xyndicate/providers': src('./packages/providers/src/index.ts'),
      '@xyndicate/tribunal': src('./packages/tribunal/src/index.ts'),
      '@xyndicate/renderers': src('./packages/renderers/src/index.ts'),
      '@xyndicate/receipts': src('./packages/receipts/src/index.ts'),
      '@xyndicate/contracts': src('./packages/contracts/src/index.ts'),
      '@xyndicate/mcp-server': src('./packages/mcp-server/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'e2e/**'],
    environment: 'node',
  },
})
