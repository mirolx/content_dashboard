import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'
import { pillClass } from '@/components/ui/pill-tabs'

export default async function NotFound() {
  const t = await getTranslations('nav')
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card title="404" tone="cream">
          <Link href="/" data-magnetic className={pillClass(true)}>
            {t('youtube')}
          </Link>
        </Card>
      </div>
    </main>
  )
}
