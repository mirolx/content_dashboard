import { parseDuration } from './parseDuration'

export const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'

/** 이 길이(초) 이하인 영상은 숏츠로 보고 추천에서 뺀다. */
export const MAX_SHORTS_SEC = 180

export class YouTubeApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'YouTubeApiError'
    this.status = status
  }
}

export type VideoDetail = {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  viewCount: number
  thumbnailUrl: string
  durationSec: number
  categoryId: string
  publishedAt: string
  tags: string[]
  description: string
}

type VideosResponse = {
  items?: {
    id: string
    snippet: {
      title: string
      channelId: string
      channelTitle: string
      categoryId?: string
      publishedAt: string
      tags?: string[]
      description?: string
      thumbnails: Record<string, { url: string } | undefined>
    }
    statistics: { viewCount?: string }
    contentDetails: { duration?: string }
  }[]
}

export async function getJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const res = await fetchImpl(url, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text()
    throw new YouTubeApiError(res.status, body.slice(0, 300))
  }
  return (await res.json()) as T
}

/** 영상 상세(제목·조회수·길이·카테고리)를 50개씩 나눠 조회한다. 호출당 1 unit. */
export async function fetchVideoDetails(
  apiKey: string,
  ids: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<VideoDetail[]> {
  const details: VideoDetail[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({
      part: 'snippet,statistics,contentDetails',
      id: ids.slice(i, i + 50).join(','),
      key: apiKey,
    })
    const data = await getJson<VideosResponse>(fetchImpl, `${YOUTUBE_API}/videos?${params}`)
    for (const v of data.items ?? []) {
      details.push({
        videoId: v.id,
        title: v.snippet.title,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        viewCount: Number(v.statistics.viewCount ?? 0),
        thumbnailUrl: v.snippet.thumbnails.medium?.url ?? v.snippet.thumbnails.default?.url ?? '',
        durationSec: parseDuration(v.contentDetails.duration ?? ''),
        categoryId: v.snippet.categoryId ?? '',
        publishedAt: v.snippet.publishedAt,
        tags: v.snippet.tags ?? [],
        description: (v.snippet.description ?? '').slice(0, 500),
      })
    }
  }
  return details
}
