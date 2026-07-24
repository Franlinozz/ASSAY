'use client'

import { useEffect, useState } from 'react'

// Theme toggle — both themes are first-class (AGENTS.md). The boot script in layout.tsx sets
// data-theme before paint; this control just flips it and persists the choice.
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    setTheme(current === 'dark' ? 'dark' : 'light')
  }, [])

  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('assay-theme', next)
    } catch {
      /* private mode — theme still flips for this page */
    }
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      data-testid="theme-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 999,
        border: '1px solid var(--hairline-strong)',
        background: 'transparent',
        color: 'var(--ink-soft)',
        cursor: 'pointer',
      }}
    >
      {/* one glyph, two states: a hallmarked disc that fills in dark */}
      <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
        <circle
          cx="7.5"
          cy="7.5"
          r="6"
          fill={theme === 'dark' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {theme !== 'dark' && <path d="M7.5 1.5 A6 6 0 0 1 7.5 13.5 Z" fill="currentColor" />}
      </svg>
    </button>
  )
}
