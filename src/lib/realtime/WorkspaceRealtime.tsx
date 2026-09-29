'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { newId } from '@/lib/id'
import { createClient } from '@/lib/supabase/client'
import { WORKSPACE_TABLES, type LiveTable } from '@/lib/types'
import { toChangeEvent, type ChangeEvent, type RealtimePayload, type Row } from './applyChange'

type Handler = (event: ChangeEvent<Row>) => void

type RealtimeContextValue = {
  workspaceId: string
  /** 재연결될 때마다 1씩 증가 — 위젯이 데이터를 다시 조회하는 신호 */
  resyncKey: number
  subscribe: (table: LiveTable, handler: Handler) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

/**
 * 워크스페이스당 Realtime 채널 하나를 열고, 테이블별 변경을 구독한 위젯에 나눠 준다.
 * RLS가 적용되므로 본인 데이터 변경만 온다.
 */
export function WorkspaceRealtime({
  workspaceId,
  children,
}: {
  workspaceId: string
  children: ReactNode
}) {
  const handlers = useRef(new Map<LiveTable, Set<Handler>>())
  const [resyncKey, setResyncKey] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const dispatch =
      (table: LiveTable) => (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const event = toChangeEvent(payload as RealtimePayload)
        if (event) handlers.current.get(table)?.forEach((handle) => handle(event))
      }

    let channel: RealtimeChannel | null = null
    let cancelled = false

    // 로그인 토큰을 Realtime에 먼저 넣고 구독한다. 토큰 없이(anon으로) 접속하면 RLS 때문에
    // 이벤트가 오지 않고, workspaces 구독은 "invalid column for filter id"로 거부된다.
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      await supabase.realtime.setAuth(session?.access_token ?? null)
      if (cancelled) return

      // 마운트마다 고유한 topic을 써서, 아직 leave 중인 이전 채널(예: 빠른 재마운트)과
      // 같은 이름을 재사용해 구독이 뒤섞이는 일을 막는다.
      channel = supabase.channel(`workspace:${workspaceId}:${newId()}`)
      const filter = `workspace_id=eq.${workspaceId}`
      for (const table of WORKSPACE_TABLES) {
        channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, dispatch(table))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, dispatch(table))
          // DELETE 이벤트에는 필터가 적용되지 않는다. 목록에 없는 id는 applyChange가 무시한다.
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, dispatch(table))
      }
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` },
        dispatch('workspaces'),
      )

      let connectedOnce = false
      channel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (connectedOnce) setResyncKey((k) => k + 1)
        connectedOnce = true
      })
    })()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [workspaceId])

  const subscribe = useCallback((table: LiveTable, handler: Handler) => {
    const map = handlers.current
    if (!map.has(table)) map.set(table, new Set())
    map.get(table)!.add(handler)
    return () => {
      map.get(table)?.delete(handler)
    }
  }, [])

  const value = useMemo(
    () => ({ workspaceId, resyncKey, subscribe }),
    [workspaceId, resyncKey, subscribe],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

function useRealtimeContext() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('WorkspaceRealtime provider is missing')
  return ctx
}

export function useWorkspaceId() {
  return useRealtimeContext().workspaceId
}

export function useResyncKey() {
  return useRealtimeContext().resyncKey
}

/** handler는 useCallback으로 고정해서 넘긴다. */
export function useRealtimeTable<T extends Row>(
  table: LiveTable,
  handler: (event: ChangeEvent<T>) => void,
) {
  const { subscribe } = useRealtimeContext()
  useEffect(() => subscribe(table, handler as Handler), [subscribe, table, handler])
}
