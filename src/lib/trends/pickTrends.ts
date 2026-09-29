import type { TrendSource } from '@/lib/types'
import type { VideoDetail } from '@/lib/youtube/api'

export type PickedTrend = VideoDetail & { source: TrendSource }

/**
 * 채널 후보와 키워드 후보(각각 이미 정렬됨)에서 perSource개씩 고르고,
 * 한쪽이 모자라면 다른 쪽으로 채워 최대 total개를 돌려준다.
 * 같은 영상은 채널 쪽에만 둔다.
 */
export function pickTrends(
  channel: VideoDetail[],
  keyword: VideoDetail[],
  perSource = 4,
  total = 8,
): PickedTrend[] {
  const channelIds = new Set(channel.map((x) => x.videoId))
  const keywordOnly = keyword.filter((x) => !channelIds.has(x.videoId))

  let fromChannel = Math.min(perSource, channel.length)
  let fromKeyword = Math.min(perSource, keywordOnly.length)
  const spare = total - fromChannel - fromKeyword
  if (spare > 0) {
    const extraChannel = Math.min(spare, channel.length - fromChannel)
    fromChannel += extraChannel
    fromKeyword = Math.min(keywordOnly.length, fromKeyword + spare - extraChannel)
  }

  return [
    ...channel.slice(0, fromChannel).map((x) => ({ ...x, source: 'channel' as const })),
    ...keywordOnly.slice(0, fromKeyword).map((x) => ({ ...x, source: 'keyword' as const })),
  ]
}
