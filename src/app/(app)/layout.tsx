import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { PlatformScope } from '@/components/PlatformScope'
import { signOut } from './actions'
import { WorkspaceTabs } from './WorkspaceTabs'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav')

  return (
    <PlatformScope>
      <div className="mx-auto max-w-7xl px-4 py-4">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 pb-3">
          <WorkspaceTabs />
          <form action={signOut}>
            <button type="submit" className="text-sm underline">
              {t('logout')}
            </button>
          </form>
        </header>
        {children}
      </div>
    </PlatformScope>
  )
}
