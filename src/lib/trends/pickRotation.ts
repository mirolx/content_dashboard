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

/**
 * 가장 오래 검색하지 않은 그룹 `groups`개를 고르고, 각 그룹에서 가장 오래된 키워드를 `perGroup`개까지 뽑는다.
 * 그룹의 오래됨 = 그 그룹에서 가장 오래된 키워드. 같으면 그룹 이름 가나다순(그룹 없음은 마지막).
 * 결과는 선택된 그룹 순서, 그룹 안에서는 오래된 순이다.
 */
export function pickRotation<T extends RotationKeyword>(
  keywords: T[],
  { groups = 4, perGroup = 4 }: { groups?: number; perGroup?: number } = {},
): T[] {
  const byGroup = new Map<string | null, T[]>()
  for (const k of keywords) byGroup.set(k.group_name, [...(byGroup.get(k.group_name) ?? []), k])
  const sorted = [...byGroup.entries()].map(([name, list]) => ({ name, list: [...list].sort(byStaleness) }))
  sorted.sort((a, b) => {
    const [x, y] = [a.list[0].last_searched_on, b.list[0].last_searched_on]
    if (x !== y) return x === null ? -1 : y === null ? 1 : x < y ? -1 : 1
    return a.name === null ? 1 : b.name === null ? -1 : a.name.localeCompare(b.name)
  })
  return sorted.slice(0, groups).flatMap((g) => g.list.slice(0, perGroup))
}
