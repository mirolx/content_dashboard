export type Row = { id: string }

export type ChangeEvent<T extends Row> =
  | { type: 'INSERT' | 'UPDATE'; row: T }
  | { type: 'DELETE'; id: string }

/** Supabase postgres_changes payload 중 우리가 쓰는 부분 */
export type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

/**
 * 목록에 변경 하나를 반영한다. INSERT/UPDATE는 id 기준 upsert라서
 * 낙관적으로 추가한 행의 실시간 에코가 와도 중복되지 않는다.
 * 목록에 없는 id의 DELETE는 같은 배열을 그대로 돌려준다(리렌더 없음).
 */
export function applyChange<T extends Row>(
  list: T[],
  event: ChangeEvent<T>,
  compare?: (a: T, b: T) => number,
): T[] {
  let next: T[]
  if (event.type === 'DELETE') {
    if (!list.some((r) => r.id === event.id)) return list
    next = list.filter((r) => r.id !== event.id)
  } else {
    const exists = list.some((r) => r.id === event.row.id)
    next = exists
      ? list.map((r) => (r.id === event.row.id ? event.row : r))
      : [...list, event.row]
  }
  return compare ? [...next].sort(compare) : next
}

/**
 * 낙관적으로 반영한 event가 서버 write 실패로 되돌려야 할 때 쓴다.
 * event.row 전체가 아니라, event가 실제로 바꾼 필드만 되돌린다 — 그 사이
 * 다른 mutate나 실시간 변경이 같은 행의 다른 필드를 바꿨다면 그 값은 보존한다.
 */
export function rollbackChange<T extends Row>(
  list: T[],
  event: ChangeEvent<T>,
  before: T | undefined,
  compare?: (a: T, b: T) => number,
): T[] {
  const id = event.type === 'DELETE' ? event.id : event.row.id
  let next: T[]

  if (event.type === 'INSERT') {
    // 낙관적으로 추가한 행을 제거한다. 이미 없으면 그대로 둔다.
    if (!list.some((r) => r.id === id)) return list
    next = list.filter((r) => r.id !== id)
  } else if (event.type === 'DELETE') {
    // before가 있고 아직 목록에 돌아오지 않았을 때만 다시 넣는다(중복 방지).
    if (before === undefined || list.some((r) => r.id === id)) return list
    next = [...list, before]
  } else {
    const current = list.find((r) => r.id === id)
    if (before === undefined || current === undefined) return list
    // event가 바꾼 필드 중, 현재 값이 그 patch 값과 여전히 같은 것만 되돌린다.
    const patched: T = { ...current }
    let changed = false
    for (const key of Object.keys(event.row) as (keyof T)[]) {
      if (event.row[key] === before[key]) continue
      if (current[key] === event.row[key]) {
        patched[key] = before[key]
        changed = true
      }
    }
    if (!changed) return list
    next = list.map((r) => (r.id === id ? patched : r))
  }

  return compare ? [...next].sort(compare) : next
}

export function toChangeEvent(payload: RealtimePayload): ChangeEvent<Row> | null {
  if (payload.eventType === 'DELETE') {
    const id = payload.old.id
    return typeof id === 'string' ? { type: 'DELETE', id } : null
  }
  return { type: payload.eventType, row: payload.new as Row }
}
