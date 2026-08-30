import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Use the compiler API instead of Next 16's CLI subprocess path; the workspace still runs its
  // strict `tsc --noEmit` gate before production builds.
  experimental: { useTypeScriptCli: false },
  // Served at assayed.xyz/docs behind Caddy — basePath keeps every asset under /docs/_next.
  basePath: '/docs',
}

export default withMDX(config)
