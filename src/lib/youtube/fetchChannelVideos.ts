import {
  byViewsDesc,
  fetchVideoDetails,
  getJson,
  MAX_SHORTS_SEC,
  YOUTUBE_API,
  YouTubeApiError,
  type VideoDetail,
} from './api'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000
/** 한 채널이 추천 자리를 독차지하지 않도록 채널당 이 개수까지만 고른다. */
export const MAX_PER_CHANNEL = 2

type PlaylistItemsResponse = { items?: { contentDetails?: { videoId?: string } }[] }

/**
 * 채널 업로드 목록에서 최근 영상을 읽어, 최근 30일·3분 초과 영상을 조회수 순으로
 * 채널당 최대 2개씩 돌려준다. 할당량: 채널당 1 unit + videos 1 unit/50개.
 */
export async function fetchChannelVideos({
  apiKey,
  playlistIds,
  now,
  fetchImpl = fetch,
}: {
  apiKey: string
  playlistIds: string[]
  now: Date
  fetchImpl?: typeof fetch
}): Promise<VideoDetail[]> {
  if (playlistIds.length === 0) return []

  const idLists = await Promise.all(
    playlistIds.map(async (playlistId) => {
      const params = new URLSearchParams({ part: 'contentDetails', playlistId, maxResults: '20', key: apiKey })
      try {
        const data = await getJson<PlaylistItemsResponse>(fetchImpl, `${YOUTUBE_API}/playlistItems?${params}`)
        return (data.items ?? []).map((i) => i.contentDetails?.videoId).filter((id): id is string => !!id)
      } catch (err) {
        // 삭제되거나 비공개가 된 채널은 건너뛴다. 그 밖의 오류는 전체 실패로 올린다.
        if (err instanceof YouTubeApiError && err.status === 404) return []
        throw err
      }
    }),
  )

  const ids = [...new Set(idLists.flat())]
  if (ids.length === 0) return []

  const since = now.getTime() - WINDOW_MS
  const videos = (await fetchVideoDetails(apiKey, ids, fetchImpl))
    .filter((v) => v.durationSec > MAX_SHORTS_SEC && Date.parse(v.publishedAt) >= since)
    .sort(byViewsDesc)

  const perChannel = new Map<string, number>()
  return videos.filter((v) => {
    const count = perChannel.get(v.channelId) ?? 0
    if (count >= MAX_PER_CHANNEL) return false
    perChannel.set(v.channelId, count + 1)
    return true
  })
}
