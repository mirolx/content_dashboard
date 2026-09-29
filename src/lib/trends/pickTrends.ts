import type { TrendSource } from '@/lib/types'
import type { VideoDetail } from '@/lib/youtube/api'

export type PickedTrend = VideoDetail & { source: TrendSource }

/**
 * 채널 후보와 키워드 후보(각각 이미 정렬됨)에서 perSource개씩 고르고,
 * 한쪽이 모자라면 다른 쪽으로 채워 최대 total개를 돌려준다.
 * 같은 영상이 채널 쪽에서 실제로 뽑혔다면 키워드 쪽에서는 뺀다.
 */
export function pickTrends(
  channel: VideoDetail[],
  keyword: VideoDetail[],
  perSource = 4,
  total = 8,
): PickedTrend[] {
  const keywordNotIn = (picked: VideoDetail[]) => {
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
