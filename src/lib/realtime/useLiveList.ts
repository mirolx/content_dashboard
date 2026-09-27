'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkspaceTable } from '@/lib/types'
import { applyChange, rollbackChange, type ChangeEvent, type Row } from './applyChange'
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

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** 목록을 서버에서 다시 조회한다. 재연결 resync와 실패 후 재조정 양쪽에서 쓴다. */
  const refetch = useCallback(async () => {
    const { data, error: fetchError } = await createClient()
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId)

    if (!mountedRef.current || fetchError || !data) return false
    const fresh = data as T[]
    setRows(compare ? [...fresh].sort(compare) : fresh)
    return true
  }, [table, workspaceId, compare])

  // 재연결되면 놓친 변경이 있을 수 있으니 한 번 다시 조회한다.
  const resyncKey = useResyncKey()
  useEffect(() => {
    if (resyncKey === 0) return
    void refetch()
  }, [resyncKey, refetch])

  /** 화면을 먼저 바꾸고 write()를 실행한다. 실패하면 패치한 필드만 되돌리고
   * 서버 상태로 재조정한 뒤 false를 반환한다. */
  const mutate = useCallback(
    async (event: ChangeEvent<T>, write: () => PromiseLike<WriteResult>) => {
      const id = event.type === 'DELETE' ? event.id : event.row.id
      const before = rowsRef.current.find((r) => r.id === id)

      // 같은 tick에서 mutate가 두 번 호출돼도 두 번째가 첫 번째 변경을 보도록
      // rowsRef를 먼저 갱신한다.
      rowsRef.current = applyChange(rowsRef.current, event, compare)
      setRows((cur) => applyChange(cur, event, compare))
      setError(null)

      const { error: writeError } = await write()
      if (!writeError) return true

      setRows((cur) => rollbackChange(cur, event, before, compare))
      setError(writeError.message)
      // 롤백만으로는 그 사이 다른 실패/실시간 변경과 얽힌 상태를 완전히 복구하지
      // 못할 수 있으니, 서버에서 다시 조회해 맞춘다. 재조회 실패 시 롤백된
      // 상태를 유지한다.
      void refetch()
      return false
    },
    [compare, refetch],
  )

  return { rows, mutate, error }
}
