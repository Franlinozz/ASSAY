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
      title={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
      data-testid="theme-toggle"
      data-theme-state={theme ?? 'light'}
      className="theme-toggle"
    >
      <span className="theme-toggle-disc" aria-hidden="true">
        {theme === 'dark' ? (
          <svg
            className="theme-toggle-icon theme-toggle-sun"
            width="18"
            height="18"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="3.75" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2.5v2.25M12 19.25v2.25M2.5 12h2.25M19.25 12h2.25" />
              <path d="m5.28 5.28 1.6 1.6m10.24 10.24 1.6 1.6M18.72 5.28l-1.6 1.6M6.88 17.12l-1.6 1.6" />
            </g>
          </svg>
        ) : (
          <svg
            className="theme-toggle-icon theme-toggle-moon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
          >
            <path
              d="M18.7 15.28A7.6 7.6 0 0 1 8.72 5.3 7.6 7.6 0 1 0 18.7 15.28Z"
              fill="currentColor"
            />
            <circle cx="17.7" cy="6.4" r="1.15" fill="currentColor" opacity="0.72" />
            <path
              d="M15.1 3.3v1.8M14.2 4.2H16"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.58"
            />
          </svg>
        )}
      </span>
      <span className="visually-hidden">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
    </button>
  )
}
