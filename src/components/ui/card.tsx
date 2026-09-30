import type { ReactNode } from 'react'

export type CardTone = 'cream' | 'accent' | 'dark'

const TONES: Record<CardTone, string> = {
  cream: 'bg-cream text-ink',
  accent: 'bg-accent text-ink',
  dark: 'bg-panel text-cream border border-line',
}

export function Card({
  title,
  tone = 'dark',
  error,
  action,
  children,
}: {
  title: string
  tone?: CardTone
  error?: string | null
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`h-full rounded-[20px] p-5 ${TONES[tone]}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
        {action}
      </div>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-danger/15 px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {children}
    </section>
  )
}
