import { scoreAll, type ScoredVideo } from '@/lib/trends/scoreVideo'
import {
  fetchVideoDetails,
  getJson,
  MAX_SHORTS_SEC,
  YOUTUBE_API,
  YouTubeApiError,
} from './api'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000
/** 한 채널이 추천 자리를 독차지하지 않도록 채널당 이 개수까지만 고른다. */
export const MAX_PER_CHANNEL = 2
/** 오늘 로테이션 키워드와 맞으면 정렬할 때 키워드당 더하는 점수 (저장되는 relevance에는 넣지 않는다). */
export const BOOST_POINTS = 2

type PlaylistItemsResponse = { items?: { contentDetails?: { videoId?: string } }[] }

/**
 * 채널 업로드 목록에서 최근 영상을 읽어, 최근 30일·3분 초과 영상을 관련도 → 조회수 순으로
 * 채널당 최대 2개씩 돌려준다. 할당량: 채널당 1 unit + videos 1 unit/50개.
 * 오늘 키워드(`boost`)와 맞는 영상은 정렬에서 키워드당 2점을 더 받는다.
 */
export async function fetchChannelVideos({
  apiKey,
  playlistIds,
  pool,
  boost = [],
  now,
  fetchImpl = fetch,
}: {
  apiKey: string
  playlistIds: string[]
  pool: string[]
  boost?: string[]
  now: Date
  fetchImpl?: typeof fetch
}): Promise<ScoredVideo[]> {
  if (playlistIds.length === 0) return []

  const idLists = await Promise.all(
    playlistIds.map(async (playlistId) => {
      const params = new URLSearchParams({ part: 'contentDetails', playlistId, maxResults: '20', key: apiKey })
      try {
        const data = await getJson<PlaylistItemsResponse>(fetchImpl, `${YOUTUBE_API}/playlistItems?${params}`)
        return (data.items ?? []).map((i) => i.contentDetails?.videoId).filter((id): id is string => !!id)
      } catch (err) {
        // 삭제·비공개(404)이거나 접근할 수 없는(403) 채널은 건너뛴다. 그 밖의 오류는 전체 실패로 올린다.
        if (err instanceof YouTubeApiError && (err.status === 404 || err.status === 403)) return []
        throw err
      }
    }),
  )

  const ids = [...new Set(idLists.flat())]
  if (ids.length === 0) return []

  const since = now.getTime() - WINDOW_MS
  const recent = (await fetchVideoDetails(apiKey, ids, fetchImpl)).filter(
    (v) => v.durationSec > MAX_SHORTS_SEC && Date.parse(v.publishedAt) >= since,
  )
  const boosted = new Set(boost.map((k) => k.trim().toLowerCase()))
  const sortScore = (v: ScoredVideo) =>
    v.relevance + BOOST_POINTS * v.matched.filter((k) => boosted.has(k.trim().toLowerCase())).length
  const videos = scoreAll(recent, pool).sort((a, b) => sortScore(b) - sortScore(a) || b.viewCount - a.viewCount)

  const perChannel = new Map<string, number>()
  return videos.filter((v) => {
    const count = perChannel.get(v.channelId) ?? 0
    if (count >= MAX_PER_CHANNEL) return false
    perChannel.set(v.channelId, count + 1)
    return true
  })
}
