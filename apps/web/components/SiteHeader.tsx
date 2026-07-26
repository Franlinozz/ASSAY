'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { href: '/gallery', label: 'Gallery' },
  { href: '/standard', label: 'The Standard' },
  { href: '/evaluation', label: 'Evaluation' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/agents', label: 'For Agents' },
  { href: '/verify', label: 'Verify' },
  { href: '/docs', label: 'Docs' },
] as const

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="container site-header-row">
        <Link href="/" className="wordmark-sm brand-lockup" aria-label="Assay — home">
          <span className="brand-mark" aria-hidden="true">
            <img className="brand-mark-light" src="/brand/mark-light.webp" alt="" />
            <img className="brand-mark-dark" src="/brand/mark-dark.webp" alt="" />
          </span>
          <span>ASSAY</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="site-nav-link"
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-header-actions">
          <Link href="/studio" className="btn btn-primary btn-sm">
            Open the Studio
          </Link>
          <ThemeToggle />
          <button
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
              {open ? (
                <g stroke="currentColor" strokeWidth="1.4">
                  <line x1="2" y1="1" x2="14" y2="11" />
                  <line x1="14" y1="1" x2="2" y2="11" />
                </g>
              ) : (
                <g stroke="currentColor" strokeWidth="1.4">
                  <line x1="0" y1="1" x2="16" y2="1" />
                  <line x1="0" y1="6" x2="16" y2="6" />
                  <line x1="0" y1="11" x2="16" y2="11" />
                </g>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Primary, mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-nav-link"
              aria-current={pathname === item.href ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/studio"
            className="mobile-nav-link mobile-nav-cta"
            onClick={() => setOpen(false)}
          >
            Open the Studio →
          </Link>
        </nav>
      )}
    </header>
  )
}
