'use client'

import { useState } from 'react'

export function CopyButton({ text, label = 'copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        })
      }}
      aria-label={`Copy ${label} to clipboard`}
    >
      {done ? '✓ copied' : label}
    </button>
  )
}
