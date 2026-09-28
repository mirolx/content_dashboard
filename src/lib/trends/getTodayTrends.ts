import { requireUser } from '@/lib/auth/requireUser'
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import type { TrendTopic } from '@/lib/types'
import { fetchTrends } from '@/lib/youtube/fetchTrends'

export type TrendsResult =
  | { status: 'ok'; topics: TrendTopic[] }
  | { status: 'no-keywords' }
  | { status: 'failed'; fallback: TrendTopic[]; fetchedOn: string | null }

/**
 * 오늘(한국 시간) 저장된 트렌드가 있으면 그대로, 없으면 YouTube에서 가져와 저장한다.
 * 실패하면 아무것도 저장하지 않고 가장 최근 날짜의 트렌드를 폴백으로 돌려준다.
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

  const existing = await todays()
  if (existing.data && existing.data.length > 0) {
    return { status: 'ok', topics: existing.data as TrendTopic[] }
  }

  const { data: keywordRows } = await supabase
    .from('trend_keywords')
    .select('keyword')
    .eq('workspace_id', workspaceId)
  const keywords = (keywordRows ?? []).map((r) => r.keyword as string)
  if (keywords.length === 0) return { status: 'no-keywords' }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

    const videos = await fetchTrends({ apiKey, keywords, now: new Date() })
    if (videos.length > 0) {
      const { error } = await supabase.from('trend_topics').upsert(
        videos.map((v) => ({
          workspace_id: workspaceId,
          fetched_on: today,
          video_id: v.videoId,
          title: v.title,
          channel_title: v.channelTitle,
          view_count: v.viewCount,
          thumbnail_url: v.thumbnailUrl,
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
}
