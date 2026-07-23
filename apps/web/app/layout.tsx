import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { BRAND } from './brand'
import './globals.css'

export const metadata: Metadata = {
  title: BRAND.title,
  description: BRAND.description,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
