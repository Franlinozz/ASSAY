import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Served at assayed.xyz/docs behind Caddy — basePath keeps every asset under /docs/_next.
  basePath: '/docs',
}

export default withMDX(config)
