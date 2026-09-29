/** 같은 그룹의 키워드를 최대 perQuery개씩 "a|b|c" 검색어로 묶는다. YouTube 검색은 | 를 OR로 해석한다. */
export function buildOrQueries(
  picked: { keyword: string; group_name: string | null }[],
  perQuery = 4,
): string[] {
  const groups = new Map<string | null, string[]>()
  for (const { keyword, group_name } of picked) {
    groups.set(group_name, [...(groups.get(group_name) ?? []), keyword])
  }
  const queries: string[] = []
  for (const keywords of groups.values()) {
    for (let i = 0; i < keywords.length; i += perQuery) {
      queries.push(keywords.slice(i, i + perQuery).join('|'))
    }
  }
  return queries
}
