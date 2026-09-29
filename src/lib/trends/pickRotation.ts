export type RotationKeyword = {
  id: string
  keyword: string
  group_name: string | null
  last_searched_on: string | null
  created_at: string
}

/** 오래 검색하지 않은 순(한 번도 안 한 것 먼저), 같으면 등록 순 */
function byStaleness(a: RotationKeyword, b: RotationKeyword) {
  if (a.last_searched_on !== b.last_searched_on) {
    if (a.last_searched_on === null) return -1
    if (b.last_searched_on === null) return 1
    return a.last_searched_on < b.last_searched_on ? -1 : 1
  }
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}

/** 그룹을 가나다순(그룹 없음은 마지막)으로 돌며 각 그룹에서 가장 오래된 키워드를 하나씩 뽑아 n개를 채운다. */
export function pickRotation<T extends RotationKeyword>(keywords: T[], n = 10): T[] {
  const groups = new Map<string | null, T[]>()
  for (const k of keywords) groups.set(k.group_name, [...(groups.get(k.group_name) ?? []), k])
  const order = [...groups.keys()].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b),
  )
  const queues = order.map((g) => [...groups.get(g)!].sort(byStaleness))

  const picked: T[] = []
  while (picked.length < n && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      if (picked.length >= n) break
      const next = queue.shift()
      if (next) picked.push(next)
    }
  }
  return picked
}
