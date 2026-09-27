'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { setLocale } from '@/i18n/actions'
import { LOCALES, type Locale } from '@/i18n/locale'

// 언어 이름은 각 언어로 표기하는 것이 관례라 번역하지 않는다.
const LABELS: Record<Locale, string> = { ko: '한국어', en: 'English' }

export function LanguageToggle() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div role="group" aria-label={t('language')} className="flex items-center gap-2">
      <span className="text-sm">{t('language')}</span>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={l === locale}
          onClick={() =>
            startTransition(async () => {
              await setLocale(l)
              router.refresh()
            })
          }
          className={`rounded px-3 py-1 text-sm ${
            l === locale ? 'bg-gray-900 text-white' : 'border border-gray-300'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  )
}
