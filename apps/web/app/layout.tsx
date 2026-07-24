import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import localFont from 'next/font/local'
import { SiteHeader } from '../components/SiteHeader'
import { SiteFooter } from '../components/SiteFooter'
import { SITE } from '../lib/site'
import './globals.css'

// Self-hosted variable fonts (AGENTS.md §DESIGN TOKENS) — no network fetch, no layout shift.
const fraunces = localFont({
  src: [
    { path: '../fonts/Fraunces-var.woff2', style: 'normal' },
    { path: '../fonts/Fraunces-var-italic.woff2', style: 'italic' },
  ],
  variable: '--font-fraunces',
  display: 'swap',
})
const inter = localFont({
  src: '../fonts/Inter-var.woff2',
  variable: '--font-inter',
  display: 'swap',
})
const jbmono = localFont({
  src: '../fonts/JetBrainsMono-var.woff2',
  variable: '--font-jbmono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    siteName: SITE.name,
    type: 'website',
    images: ['/og/default.png'],
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf9f3' },
    { media: '(prefers-color-scheme: dark)', color: '#131519' },
  ],
}

// Runs before paint: honor a saved choice, else the OS preference. Both themes are first-class.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('assay-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${jbmono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <SiteHeader />
        <main id="main" style={{ flex: 1 }}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
