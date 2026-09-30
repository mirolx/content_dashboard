'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function AppError({ reset }: { reset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="mx-auto max-w-md py-16">
      <Card title={t('loadFailed')} tone="cream">
        <Button onClick={reset}>{t('retry')}</Button>
      </Card>
    </div>
  )
}
