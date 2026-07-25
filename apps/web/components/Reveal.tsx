import type { ReactNode } from 'react'

export function Reveal({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section'
}) {
  const classes = ['reveal-on-scroll', className].filter(Boolean).join(' ')

  return as === 'section' ? (
    <section className={classes}>{children}</section>
  ) : (
    <div className={classes}>{children}</div>
  )
}
