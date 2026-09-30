'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PillTabs } from '@/components/ui/pill-tabs'
import { platformFromPath } from '@/lib/platform'
import { PLATFORMS } from '@/lib/types'

export function WorkspaceTabs() {
  const t = useTranslations('nav')
  const pathname = usePathname() ?? ''
  const current = platformFromPath(pathname)

  const items = PLATFORMS.map((p) => ({ href: `/${p}`, label: t(p), active: current === p }))
  if (current) {
    items.push({
      href: `/${current}/settings`,
      label: t('settings'),
      active: pathname === `/${current}/settings`,
    })
  }
  return <PillTabs items={items} />
}
