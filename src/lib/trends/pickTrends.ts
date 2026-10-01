import type { TrendSource } from '@/lib/types'
import type { VideoDetail } from '@/lib/youtube/api'

export type PickedTrend<T extends VideoDetail = VideoDetail> = T & { source: TrendSource }

/** 이 관련도 이상(키워드 2개 이상 매칭)인 영상만 새 주제로 앞당긴다. 키워드 하나만 맞은 영상이 앞지르지 않게. */
export const MIN_PROMOTE_RELEVANCE = 3

/**
 * 앞에서부터 아직 나오지 않은 대표 그룹(matched[0]의 그룹)이면서 관련도가 minRelevance 이상인 영상을 먼저 두고,
 * 나머지(이미 나온 그룹, 매칭 없음, 관련도 부족)는 원래 순서대로 뒤에 붙인다.
 */
export function diverseOrder<T extends { matched?: string[]; relevance?: number }>(
  list: T[],
  groupOf: (keyword: string) => string,
  minRelevance = 0,
): T[] {
  const seen = new Set<string>()
  const first: T[] = []
  const later: T[] = []
  for (const x of list) {
    const top = x.matched?.[0]
    const group = top === undefined ? undefined : groupOf(top)
    if (group === undefined || seen.has(group) || (x.relevance ?? 0) < minRelevance) later.push(x)
    else {
      seen.add(group)
      first.push(x)
    }
  }
  return [...first, ...later]
}

/**
 * 채널 후보와 키워드 후보(각각 이미 정렬됨)에서 perSource개씩 고르고,
 * 한쪽이 모자라면 다른 쪽으로 채워 최대 total개를 돌려준다.
 * 같은 영상이 채널 쪽에서 실제로 뽑혔다면 키워드 쪽에서는 뺀다.
 * `groupOf`가 있으면 각 목록을 먼저 `diverseOrder`(관련도 3 이상만 앞당김)로 재배열한다.
 */
export function pickTrends<T extends VideoDetail & { matched?: string[]; relevance?: number }>(
  channelList: T[],
  keywordList: T[],
  {
    groupOf,
    perSource = 4,
    total = 8,
  }: { groupOf?: (keyword: string) => string; perSource?: number; total?: number } = {},
): PickedTrend<T>[] {
  const channel = groupOf ? diverseOrder(channelList, groupOf, MIN_PROMOTE_RELEVANCE) : channelList
  const keyword = groupOf ? diverseOrder(keywordList, groupOf, MIN_PROMOTE_RELEVANCE) : keywordList

  const keywordNotIn = (picked: T[]) => {
    const pickedIds = new Set(picked.map((x) => x.videoId))
    return keyword.filter((x) => !pickedIds.has(x.videoId))
  }

  let fromChannel = Math.min(perSource, channel.length)
  let keywordOnly = keywordNotIn(channel.slice(0, fromChannel))
  let fromKeyword = Math.min(perSource, keywordOnly.length)
  const spare = total - fromChannel - fromKeyword
  if (spare > 0) {
    // 키워드가 모자라면 채널을 더 뽑고, 늘어난 채널 선택분을 기준으로 키워드 중복을 다시 거른다.
    fromChannel += Math.min(spare, channel.length - fromChannel)
    keywordOnly = keywordNotIn(channel.slice(0, fromChannel))
    fromKeyword = Math.min(keywordOnly.length, total - fromChannel)
  }

  return [
    ...channel.slice(0, fromChannel).map((x) => ({ ...x, source: 'channel' as const })),
    ...keywordOnly.slice(0, fromKeyword).map((x) => ({ ...x, source: 'keyword' as const })),
  ]
}
