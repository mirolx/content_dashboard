import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WidgetCard } from '@/components/WidgetCard'
import { LanguageToggle } from '@/features/settings/LanguageToggle'
import { WorkspaceNameForm } from '@/features/settings/WorkspaceNameForm'
import { ChannelSettings } from '@/features/trends/ChannelSettings'
import { KeywordSettings } from '@/features/trends/KeywordSettings'
import { RefetchTrends } from '@/features/trends/RefetchTrends'
import { WorkspaceRealtime } from '@/lib/realtime/WorkspaceRealtime'
import { createClient } from '@/lib/supabase/server'
import { isPlatform, type BenchmarkChannel, type TrendKeyword } from '@/lib/types'
import { getWorkspace } from '@/lib/workspace'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ platform: string }>
}) {
  const { platform } = await params
  if (!isPlatform(platform)) notFound()
  const workspace = await getWorkspace(platform)
  if (!workspace) notFound()
  const t = await getTranslations('settings')

  let keywords: TrendKeyword[] = []
  let channels: BenchmarkChannel[] = []
  if (platform === 'youtube') {
    const supabase = await createClient()
    const [keywordRes, channelRes] = await Promise.all([
      supabase.from('trend_keywords').select('*').eq('workspace_id', workspace.id),
      supabase.from('benchmark_channels').select('*').eq('workspace_id', workspace.id),
    ])
    keywords = (keywordRes.data ?? []) as TrendKeyword[]
    channels = (channelRes.data ?? []) as BenchmarkChannel[]
  }

  return (
    <WorkspaceRealtime key={workspace.id} workspaceId={workspace.id}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <WidgetCard title={t('account')}>
          <LanguageToggle />
        </WidgetCard>
        <WidgetCard title={t('workspace')}>
          <WorkspaceNameForm workspaceId={workspace.id} name={workspace.name} />
        </WidgetCard>
        {platform === 'youtube' && (
          <>
            <WidgetCard title={t('benchmarkChannels')}>
              <ChannelSettings initial={channels} />
            </WidgetCard>
            <WidgetCard title={t('trendKeywords')}>
              <KeywordSettings initial={keywords} />
            </WidgetCard>
            <WidgetCard title={t('refetchTitle')}>
              <RefetchTrends />
            </WidgetCard>
          </>
        )}
      </div>
    </WorkspaceRealtime>
  )
}
