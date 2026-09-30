'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { refetchTodayTrends } from './actions'

export function RefetchTrends() {
  const t = useTranslations('settings')
  const workspaceId = useWorkspaceId()
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  const [refetching, startRefetch] = useTransition()

  function refetch() {
    setState('idle')
    startRefetch(async () => {
      const result = await refetchTodayTrends(workspaceId)
      setState('ok' in result ? 'done' : 'failed')
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="ink" onClick={refetch} disabled={refetching}>
        {t('refetch')}
      </Button>
      <span aria-live="polite" className="text-sm font-medium">
        {state === 'done' && t('refetchDone')}
        {state === 'failed' && <span className="text-ink font-semibold">{t('refetchFailed')}</span>}
      </span>
    </div>
  )
}
