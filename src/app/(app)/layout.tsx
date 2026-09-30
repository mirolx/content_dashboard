import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { PlatformScope } from '@/components/PlatformScope'
import { Button } from '@/components/ui/button'
import { signOut } from './actions'
import { WorkspaceTabs } from './WorkspaceTabs'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav')

  return (
    <PlatformScope>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <WorkspaceTabs />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              {t('logout')}
            </Button>
          </form>
        </header>
        {children}
      </div>
    </PlatformScope>
  )
}
