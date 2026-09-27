'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { WidgetCard } from '@/components/WidgetCard'
import type { ChangeEvent } from '@/lib/realtime/applyChange'
import { useAutosave } from '@/lib/realtime/useAutosave'
import { useRealtimeTable, useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { Workspace } from '@/lib/types'
import { saveMemo } from './data'

export function MemoWidget({ initialMemo }: { initialMemo: string }) {
  const t = useTranslations('memo')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const [memo, setMemo] = useState(initialMemo)
  const [focused, setFocused] = useState(false)

  const { status, schedule, flush } = useAutosave(async (value) => {
    const { error } = await saveMemo(workspaceId, value)
    return !error
  })

  // 입력 중이거나 저장 대기 중이면 다른 기기의 변경으로 덮어쓰지 않는다.
  const protectedRef = useRef(false)
  useEffect(() => {
    protectedRef.current = focused || status === 'pending' || status === 'saving'
  }, [focused, status])

  const onRemoteChange = useCallback((event: ChangeEvent<Workspace>) => {
    if (event.type === 'UPDATE' && !protectedRef.current) setMemo(event.row.memo)
  }, [])
  useRealtimeTable<Workspace>('workspaces', onRemoteChange)

  const statusText =
    status === 'pending' || status === 'saving'
      ? tc('saving')
      : status === 'saved'
        ? tc('saved')
        : status === 'error'
          ? tc('saveFailed')
          : ''

  return (
    <WidgetCard title={t('title')}>
      <textarea
        aria-label={t('label')}
        placeholder={t('placeholder')}
        value={memo}
        rows={6}
        onChange={(e) => {
          setMemo(e.target.value)
          schedule(e.target.value)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          void flush()
        }}
        className="w-full rounded border border-gray-300 p-2 text-sm"
      />
      <p aria-live="polite" className="mt-1 h-4 text-xs text-gray-500">
        {statusText}
      </p>
    </WidgetCard>
  )
}
