'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { platformFromPath } from '@/lib/platform'

/** 현재 경로의 플랫폼을 data-platform으로 달아, 그 아래의 accent 색을 바꾼다. */
export function PlatformScope({ children }: { children: ReactNode }) {
  const platform = platformFromPath(usePathname() ?? '')
  return (
    <div data-platform={platform ?? undefined} className="contents">
      {children}
    </div>
  )
}
