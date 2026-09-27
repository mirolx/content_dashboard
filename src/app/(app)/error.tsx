'use client'

import { useTranslations } from 'next-intl'

export default function AppError({ reset }: { reset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="p-8 text-center">
      <p className="mb-3">{t('loadFailed')}</p>
      <button type="button" onClick={reset} className="underline">
        {t('retry')}
      </button>
    </div>
  )
}
