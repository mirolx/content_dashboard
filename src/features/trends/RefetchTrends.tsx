'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
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
      <button
        type="button"
        onClick={refetch}
        disabled={refetching}
        className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        {t('refetch')}
      </button>
      <span aria-live="polite" className="text-sm">
        {state === 'done' && t('refetchDone')}
        {state === 'failed' && <span className="text-red-600">{t('refetchFailed')}</span>}
      </span>
    </div>
  )
}
