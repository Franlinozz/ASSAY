import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import './global.css'

export const metadata: Metadata = {
  title: {
    default: 'Assay Docs — proof before polish',
    template: '%s · Assay Docs',
  },
  description:
    'Guides and generated references for Assay: quickstart, the ten asy_* tools, the published Standard, seal verification, and x402 payment notes.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <RootProvider>
          <DocsLayout
            tree={source.pageTree}
            nav={{
              title: (
                <span style={{ fontWeight: 650, letterSpacing: '0.18em' }}>ASSAY&thinsp;/docs</span>
              ),
              url: 'https://assayed.xyz',
            }}
            links={[
              { text: 'assayed.xyz', url: 'https://assayed.xyz', external: true },
              { text: 'For Agents', url: 'https://assayed.xyz/agents', external: true },
              { text: 'Verify', url: 'https://assayed.xyz/verify', external: true },
            ]}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}
