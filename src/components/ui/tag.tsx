import type { ReactNode } from 'react'

export function Tag({ tone = 'outline', children }: { tone?: 'outline' | 'accent'; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
        tone === 'accent' ? 'bg-accent text-ink' : 'border border-current/30'
      }`}
    >
      {children}
    </span>
  )
}
