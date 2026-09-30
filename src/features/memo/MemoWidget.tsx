'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { fieldClass } from '@/components/ui/field'
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
    <Card title={t('title')} tone="cream">
      <textarea
        aria-label={t('label')}
        placeholder={t('placeholder')}
        value={memo}
        rows={6}
        onChange={(e) => {
          // Set the ref synchronously so a remote UPDATE arriving between this
          // keystroke and the next effect flush can't clobber what was just typed.
          protectedRef.current = true
          setMemo(e.target.value)
          schedule(e.target.value)
        }}
        onFocus={() => {
          // Set the ref synchronously so a remote UPDATE arriving between this
          // focus event and the next effect flush can't clobber the memo while
          // the user is about to type.
          protectedRef.current = true
          setFocused(true)
        }}
        onBlur={() => {
          setFocused(false)
          void flush()
        }}
        className={`${fieldClass} w-full`}
      />
      <p aria-live="polite" className="mt-2 h-4 text-xs opacity-75">
        {statusText}
      </p>
    </Card>
  )
}
