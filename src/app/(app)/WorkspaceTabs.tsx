'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { isPlatform, PLATFORMS } from '@/lib/types'

export function WorkspaceTabs() {
  const t = useTranslations('nav')
  const current = usePathname().split('/')[1] ?? ''

  return (
    <nav className="flex items-center gap-2">
      {PLATFORMS.map((p) => (
        <Link
          key={p}
          href={`/${p}`}
          aria-current={current === p ? 'page' : undefined}
          className={`rounded px-3 py-1 text-sm ${
            current === p ? 'bg-gray-900 text-white' : 'border border-gray-300'
          }`}
        >
          {t(p)}
        </Link>
      ))}
      {isPlatform(current) && (
        <Link href={`/${current}/settings`} className="ml-2 text-sm underline">
          {t('settings')}
        </Link>
      )}
    </nav>
  )
}
