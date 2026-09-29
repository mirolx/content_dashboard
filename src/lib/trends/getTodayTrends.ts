import { requireUser } from '@/lib/auth/requireUser'
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import type { TrendTopic } from '@/lib/types'
import { fetchChannelVideos } from '@/lib/youtube/fetchChannelVideos'
import { fetchKeywordVideos } from '@/lib/youtube/fetchKeywordVideos'
import { buildOrQueries } from './buildOrQueries'
import { pickRotation, type RotationKeyword } from './pickRotation'
import { pickTrends } from './pickTrends'

export type TrendsResult =
  | { status: 'ok'; topics: TrendTopic[] }
  | { status: 'no-sources' }
  | { status: 'failed'; fallback: TrendTopic[]; fetchedOn: string | null }

/** 하루에 가장 오래 검색하지 않은 그룹 4개 × 그룹당 최대 4개 키워드 → OR 검색 최대 4번 ≈ 400 units. */
const ROTATION_GROUPS = 4
const KEYWORDS_PER_GROUP = 4
/** 서버 액션이 등록을 10개로 막지만, 직접 insert로 우회될 수 있어 조회에서도 제한한다. */
const MAX_CHANNELS = 10

/**
 * 오늘(한국 시간) 저장된 트렌드가 있으면 그대로, 없으면 로테이션으로 고른 키워드와 벤치마킹 채널로
 * YouTube에서 가져와 관련도 점수와 함께 저장한다. 실패하면 저장하지 않고 가장 최근 날짜의 트렌드를 돌려준다.
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
      .order('relevance', { ascending: false })
      .order('view_count', { ascending: false })

  /** 조회 자체가 실패했을 때 쓰는 폴백 — 가장 최근 날짜의 트렌드를 돌려준다. */
  const fallback = async (): Promise<TrendsResult> => {
    const { data: latest } = await supabase
      .from('trend_topics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('fetched_on', { ascending: false })
      .order('relevance', { ascending: false })
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
    supabase
      .from('trend_keywords')
      .select('id, keyword, group_name, last_searched_on, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at'),
    supabase
      .from('benchmark_channels')
      .select('uploads_playlist_id')
      .eq('workspace_id', workspaceId)
      .order('created_at')
      .limit(MAX_CHANNELS),
  ])
  if (keywordRes.error || channelRes.error) return fallback()
  const keywordRows = (keywordRes.data ?? []) as RotationKeyword[]
  const playlistIds = (channelRes.data ?? []).map((r) => r.uploads_playlist_id as string)
  if (keywordRows.length === 0 && playlistIds.length === 0) return { status: 'no-sources' }

  const pool = keywordRows.map((k) => k.keyword)
  const rotation = pickRotation(keywordRows, { groups: ROTATION_GROUPS, perGroup: KEYWORDS_PER_GROUP })
  const queries = buildOrQueries(rotation)

  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

    const now = new Date()
    const [channelVideos, keywordVideos] = await Promise.all([
      fetchChannelVideos({ apiKey, playlistIds, pool, now }),
      fetchKeywordVideos({ apiKey, queries, pool, now }),
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
          relevance: v.relevance,
          matched_keywords: v.matched,
        })),
        // 탭 두 개가 동시에 갱신해도 중복 저장되지 않는다.
        { onConflict: 'workspace_id,fetched_on,video_id', ignoreDuplicates: true },
      )
      if (error) throw new Error(error.message)
    }

    if (rotation.length > 0) {
      // 로테이션 기록 실패는 결과에 영향을 주지 않는다 (다음 날 덜 골고루 돌 뿐).
      const { error: rotationError } = await supabase
        .from('trend_keywords')
        .update({ last_searched_on: today })
        .in(
          'id',
          rotation.map((k) => k.id),
        )
      if (rotationError) console.error('[trends] rotation update failed:', rotationError.message)
    }

    const saved = await todays()
    return { status: 'ok', topics: (saved.data ?? []) as TrendTopic[] }
  } catch (err) {
    console.error('[trends] refresh failed:', err)
    return fallback()
  }
}
