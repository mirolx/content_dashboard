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

/** event를 되돌리는 변경. 낙관적 업데이트 실패 시 롤백에 쓴다. */
export function inverseOf<T extends Row>(list: T[], event: ChangeEvent<T>): ChangeEvent<T> | null {
  if (event.type === 'DELETE') {
    const prev = list.find((r) => r.id === event.id)
    return prev ? { type: 'INSERT', row: prev } : null
  }
  const prev = list.find((r) => r.id === event.row.id)
  return prev ? { type: 'UPDATE', row: prev } : { type: 'DELETE', id: event.row.id }
}

export function toChangeEvent(payload: RealtimePayload): ChangeEvent<Row> | null {
  if (payload.eventType === 'DELETE') {
    const id = payload.old.id
    return typeof id === 'string' ? { type: 'DELETE', id } : null
  }
  return { type: payload.eventType, row: payload.new as Row }
}
