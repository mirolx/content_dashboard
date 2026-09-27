'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkspaceTable } from '@/lib/types'
import { applyChange, inverseOf, type ChangeEvent, type Row } from './applyChange'
import { useRealtimeTable, useResyncKey, useWorkspaceId } from './WorkspaceRealtime'

export type WriteResult = { error: { message: string } | null }

/**
 * 서버에서 받은 초기 목록 + 낙관적 변경 + 실시간 변경을 하나의 상태로 관리한다.
 * compare는 모듈 최상단 상수로 넘겨서 참조가 바뀌지 않게 한다.
 */
export function useLiveList<T extends Row>(
  table: WorkspaceTable,
  initial: T[],
  compare?: (a: T, b: T) => number,
) {
  const workspaceId = useWorkspaceId()
  const [rows, setRows] = useState<T[]>(() => (compare ? [...initial].sort(compare) : initial))
  const [error, setError] = useState<string | null>(null)
  const rowsRef = useRef(rows)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const onRemoteChange = useCallback(
    (event: ChangeEvent<T>) => setRows((cur) => applyChange(cur, event, compare)),
    [compare],
  )
  useRealtimeTable<T>(table, onRemoteChange)

  // 재연결되면 놓친 변경이 있을 수 있으니 한 번 다시 조회한다.
  const resyncKey = useResyncKey()
  useEffect(() => {
    if (resyncKey === 0) return
    let cancelled = false
    void createClient()
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId)
      .then(({ data }) => {
        if (cancelled || !data) return
        const fresh = data as T[]
        setRows(compare ? [...fresh].sort(compare) : fresh)
      })
    return () => {
      cancelled = true
    }
  }, [resyncKey, table, workspaceId, compare])

  /** 화면을 먼저 바꾸고 write()를 실행한다. 실패하면 되돌리고 false를 반환한다. */
  const mutate = useCallback(
    async (event: ChangeEvent<T>, write: () => PromiseLike<WriteResult>) => {
      const inverse = inverseOf(rowsRef.current, event)
      setRows((cur) => applyChange(cur, event, compare))
      setError(null)

      const { error: writeError } = await write()
      if (!writeError) return true

      if (inverse) setRows((cur) => applyChange(cur, inverse, compare))
      setError(writeError.message)
      return false
    },
    [compare],
  )

  return { rows, mutate, error }
}
