import { requireUser } from '@/lib/auth/requireUser'
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import type { TrendTopic } from '@/lib/types'
import { fetchChannelVideos } from '@/lib/youtube/fetchChannelVideos'
import { fetchKeywordVideos } from '@/lib/youtube/fetchKeywordVideos'
import { pickTrends } from './pickTrends'

export type TrendsResult =
  | { status: 'ok'; topics: TrendTopic[] }
  | { status: 'no-sources' }
  | { status: 'failed'; fallback: TrendTopic[]; fetchedOn: string | null }

/** YouTube 할당량을 아끼기 위해 한 번의 조회에는 키워드를 최대 이 개수만큼만 쓴다. */
const MAX_KEYWORDS = 5

/**
 * 오늘(한국 시간) 저장된 트렌드가 있으면 그대로, 없으면 벤치마킹 채널과 키워드로
 * YouTube에서 가져와 저장한다. 실패하면 아무것도 저장하지 않고 가장 최근 날짜의 트렌드를 돌려준다.
 */
export async function getTodayTrends(workspaceId: string): Promise<TrendsResult> {
  await requireUser()
  const supabase = await createClient()
  const today = seoulDateString(new Date())

  const todays = () =>
    supabase
      .from('trend_topics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('fetched_on', today)
      .order('view_count', { ascending: false })

  /** 조회 자체가 실패했을 때 쓰는 폴백 — 가장 최근 날짜의 트렌드를 돌려준다. */
  const fallback = async (): Promise<TrendsResult> => {
    const { data: latest } = await supabase
      .from('trend_topics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('fetched_on', { ascending: false })
      .order('view_count', { ascending: false })
      .limit(8)
    const rows = (latest ?? []) as TrendTopic[]
    const fetchedOn = rows[0]?.fetched_on ?? null
    return { status: 'failed', fallback: rows.filter((r) => r.fetched_on === fetchedOn), fetchedOn }
  }

  const existing = await todays()
  if (existing.error) return fallback()
  if (existing.data && existing.data.length > 0) {
    return { status: 'ok', topics: existing.data as TrendTopic[] }
  }

  const [keywordRes, channelRes] = await Promise.all([
    supabase.from('trend_keywords').select('keyword').eq('workspace_id', workspaceId).order('created_at'),
    supabase
      .from('benchmark_channels')
      .select('uploads_playlist_id')
      .eq('workspace_id', workspaceId)
      .order('created_at'),
  ])
  if (keywordRes.error || channelRes.error) return fallback()
  const keywords = (keywordRes.data ?? []).map((r) => r.keyword as string).slice(0, MAX_KEYWORDS)
  const playlistIds = (channelRes.data ?? []).map((r) => r.uploads_playlist_id as string)
  if (keywords.length === 0 && playlistIds.length === 0) return { status: 'no-sources' }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

    const now = new Date()
    const [channelVideos, keywordVideos] = await Promise.all([
      fetchChannelVideos({ apiKey, playlistIds, now }),
      fetchKeywordVideos({ apiKey, keywords, now }),
    ])
    const picked = pickTrends(channelVideos, keywordVideos)

    if (picked.length > 0) {
      const { error } = await supabase.from('trend_topics').upsert(
        picked.map((v) => ({
          workspace_id: workspaceId,
          fetched_on: today,
          video_id: v.videoId,
          title: v.title,
          channel_title: v.channelTitle,
          view_count: v.viewCount,
          thumbnail_url: v.thumbnailUrl,
          source: v.source,
        })),
        // 탭 두 개가 동시에 갱신해도 중복 저장되지 않는다.
        { onConflict: 'workspace_id,fetched_on,video_id', ignoreDuplicates: true },
      )
      if (error) throw new Error(error.message)
    }

    const saved = await todays()
    return { status: 'ok', topics: (saved.data ?? []) as TrendTopic[] }
  } catch (err) {
    console.error('[trends] refresh failed:', err)
    return fallback()
  }
}
