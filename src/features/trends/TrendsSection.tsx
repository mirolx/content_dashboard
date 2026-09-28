import { createClient } from '@/lib/supabase/server'
import { getTodayTrends } from '@/lib/trends/getTodayTrends'
import { TrendsWidget } from './TrendsWidget'

/** Suspense 안에서 렌더링된다. YouTube 호출이 느려도 다른 위젯은 먼저 뜬다. */
export async function TrendsSection({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient()
  const [result, pinned] = await Promise.all([
    getTodayTrends(workspaceId),
    supabase
      .from('pinned_ideas')
      .select('source_url')
      .eq('workspace_id', workspaceId)
      .not('source_url', 'is', null),
  ])
  const pinnedUrls = (pinned.data ?? []).map((r) => r.source_url as string)
  return <TrendsWidget result={result} pinnedUrls={pinnedUrls} />
}
