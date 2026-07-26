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
            className="theme-toggle-icon theme-toggle-dawn"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M4 16.5h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path
              d="M7.25 16.5a4.75 4.75 0 0 1 9.5 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M12 4.25v2M5.9 7.1l1.4 1.4M18.1 7.1l-1.4 1.4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M7 19.5h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity=".45"
            />
          </svg>
        ) : (
          <svg
            className="theme-toggle-icon theme-toggle-orbit"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M16.9 16.45A7 7 0 0 1 8.55 7.1a7.25 7.25 0 1 0 8.35 9.35Z"
              stroke="currentColor"
              strokeWidth="1.55"
              strokeLinejoin="round"
            />
            <path
              d="M15.8 5.2h2.6M17.1 3.9v2.6"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <circle cx="18.7" cy="9.2" r=".85" fill="currentColor" opacity=".55" />
          </svg>
        )}
      </span>
      <span className="visually-hidden">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
    </button>
  )
}
