import type { ReactNode } from 'react'

export function WidgetCard({
  title,
  error,
  children,
}: {
  title: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <section className="h-full rounded-lg border border-gray-300 p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {children}
    </section>
  )
}
