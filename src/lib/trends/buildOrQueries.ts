/**
 * 같은 그룹의 키워드를 최대 perQuery개씩 '"a"|"b"|"c"' 검색어로 묶는다.
 * YouTube 검색은 따옴표 없는 공백을 AND로 해석하고 이것이 | 보다 강하게 결합하므로
 * (glow up|that girl => glow AND (up|that) AND girl), 각 키워드를 큰따옴표로 감싸 구문 단위 OR로 만든다.
 */
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
      queries.push(keywords.slice(i, i + perQuery).map((k) => `"${k}"`).join('|'))
    }
  }
  return queries
}
