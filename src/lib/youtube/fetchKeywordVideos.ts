import { byRelevanceThenViews, scoreAll, type ScoredVideo } from '@/lib/trends/scoreVideo'
import { fetchVideoDetails, getJson, MAX_SHORTS_SEC, YOUTUBE_API } from './api'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** 수다·스토리텔링 니치가 주로 속한 카테고리: People & Blogs, Comedy, Entertainment, Howto & Style */
export const NICHE_CATEGORY_IDS = new Set(['22', '23', '24', '26'])

type SearchResponse = { items?: { id?: { videoId?: string } }[] }

/**
 * OR 검색어("a|b|c")마다 영어권 최근 7일 영상을 관련도 순으로 50개씩 찾고,
 * 숏츠·니치 밖 카테고리·풀 키워드와 하나도 안 맞는 영상을 걸러 관련도 → 조회수 순으로 돌려준다.
 * 할당량: search 100 units × 검색어 수 + videos 1 unit/50개.
 */
export async function fetchKeywordVideos({
  apiKey,
  queries,
  pool,
  now,
  fetchImpl = fetch,
}: {
  apiKey: string
  queries: string[]
  pool: string[]
  now: Date
  fetchImpl?: typeof fetch
}): Promise<ScoredVideo[]> {
  if (queries.length === 0) return []

  const publishedAfter = new Date(now.getTime() - WEEK_MS).toISOString()
  const idLists = await Promise.all(
    queries.map(async (q) => {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q,
        relevanceLanguage: 'en',
        regionCode: 'US',
        order: 'relevance',
        publishedAfter,
        maxResults: '50',
        key: apiKey,
      })
      const data = await getJson<SearchResponse>(fetchImpl, `${YOUTUBE_API}/search?${params}`)
      return (data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => !!id)
    }),
  )

  const ids = [...new Set(idLists.flat())]
  if (ids.length === 0) return []

  const videos = (await fetchVideoDetails(apiKey, ids, fetchImpl)).filter(
    (v) => v.durationSec > MAX_SHORTS_SEC && NICHE_CATEGORY_IDS.has(v.categoryId),
  )
  return scoreAll(videos, pool)
    .filter((v) => v.relevance > 0)
    .sort(byRelevanceThenViews)
}
