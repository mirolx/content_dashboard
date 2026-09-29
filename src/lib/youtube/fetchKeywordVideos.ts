import { byViewsDesc, fetchVideoDetails, getJson, MAX_SHORTS_SEC, YOUTUBE_API, type VideoDetail } from './api'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** 수다·스토리텔링 니치가 주로 속한 카테고리: People & Blogs, Comedy, Entertainment, Howto & Style */
export const NICHE_CATEGORY_IDS = new Set(['22', '23', '24', '26'])

type SearchResponse = { items?: { id?: { videoId?: string } }[] }

/**
 * 키워드마다 영어권 최근 7일 영상을 관련도 순으로 찾고, 숏츠와 니치 밖 카테고리를 걸러
 * 조회수 순으로 돌려준다. 할당량: search 100 units × 키워드 수 + videos 1 unit/50개.
 */
export async function fetchKeywordVideos({
  apiKey,
  keywords,
  now,
  fetchImpl = fetch,
}: {
  apiKey: string
  keywords: string[]
  now: Date
  fetchImpl?: typeof fetch
}): Promise<VideoDetail[]> {
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
        order: 'relevance',
        publishedAfter,
        maxResults: '25',
        key: apiKey,
      })
      const data = await getJson<SearchResponse>(fetchImpl, `${YOUTUBE_API}/search?${params}`)
      return (data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => !!id)
    }),
  )

  const ids = [...new Set(idLists.flat())]
  if (ids.length === 0) return []

  const videos = await fetchVideoDetails(apiKey, ids, fetchImpl)
  return videos
    .filter((v) => v.durationSec > MAX_SHORTS_SEC && NICHE_CATEGORY_IDS.has(v.categoryId))
    .sort(byViewsDesc)
}
