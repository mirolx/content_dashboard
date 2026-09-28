const API = 'https://www.googleapis.com/youtube/v3'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type TrendVideo = {
  videoId: string
  title: string
  channelTitle: string
  viewCount: number
  thumbnailUrl: string
}

export class YouTubeApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'YouTubeApiError'
    this.status = status
  }
}

type SearchResponse = { items?: { id?: { videoId?: string } }[] }
type VideosResponse = {
  items?: {
    id: string
    snippet: {
      title: string
      channelTitle: string
      thumbnails: Record<string, { url: string } | undefined>
    }
    statistics: { viewCount?: string }
  }[]
}

/**
 * 키워드마다 영어권 최근 7일 인기 영상을 검색하고, 조회수 상위 limit개를 돌려준다.
 * 할당량: search 100 units × 키워드 수 + videos 1 unit.
 */
export async function fetchTrends({
  apiKey,
  keywords,
  now,
  limit = 8,
  fetchImpl = fetch,
}: {
  apiKey: string
  keywords: string[]
  now: Date
  limit?: number
  fetchImpl?: typeof fetch
}): Promise<TrendVideo[]> {
  if (keywords.length === 0) return []

  const publishedAfter = new Date(now.getTime() - WEEK_MS).toISOString()
  const idLists = await Promise.all(
    keywords.map(async (q) => {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q,
        relevanceLanguage: 'en',
        regionCode: 'US',
        order: 'viewCount',
        publishedAfter,
        maxResults: '10',
        key: apiKey,
      })
      const data = await getJson<SearchResponse>(fetchImpl, `${API}/search?${params}`)
      return (data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => !!id)
    }),
  )

  const ids = [...new Set(idLists.flat())].slice(0, 50)
  if (ids.length === 0) return []

  // search 결과의 제목은 HTML 이스케이프되어 있어서 videos의 snippet을 쓴다.
  const params = new URLSearchParams({ part: 'snippet,statistics', id: ids.join(','), key: apiKey })
  const data = await getJson<VideosResponse>(fetchImpl, `${API}/videos?${params}`)

  return (data.items ?? [])
    .map((v) => ({
      videoId: v.id,
      title: v.snippet.title,
      channelTitle: v.snippet.channelTitle,
      viewCount: Number(v.statistics.viewCount ?? 0),
      thumbnailUrl: v.snippet.thumbnails.medium?.url ?? v.snippet.thumbnails.default?.url ?? '',
    }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit)
}

async function getJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const res = await fetchImpl(url, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text()
    throw new YouTubeApiError(res.status, body.slice(0, 300))
  }
  return (await res.json()) as T
}
