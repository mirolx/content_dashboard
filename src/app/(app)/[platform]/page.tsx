import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WidgetCard } from '@/components/WidgetCard'
import { ChecklistWidget } from '@/features/checklist/ChecklistWidget'
import { loadDashboard } from '@/lib/dashboard'
import { WorkspaceRealtime } from '@/lib/realtime/WorkspaceRealtime'
import { isPlatform } from '@/lib/types'
import { getWorkspace } from '@/lib/workspace'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ platform: string }>
}) {
  const { platform } = await params
  if (!isPlatform(platform)) notFound()
  const workspace = await getWorkspace(platform)
  if (!workspace) notFound()

  const [data, t] = await Promise.all([loadDashboard(workspace.id), getTranslations()])
  const isYouTube = platform === 'youtube'

  return (
    // key: 탭을 바꾸면 위젯 상태를 새 워크스페이스로 완전히 초기화한다.
    <WorkspaceRealtime key={workspace.id} workspaceId={workspace.id}>
      <h1 className="mb-4 text-2xl font-bold">{workspace.name}</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* ── 오늘 할 일 ── */}
        <h2 className="text-lg font-semibold md:col-span-12">{t('dashboard.today')}</h2>
        <div className="md:col-span-7">
          <WidgetCard title={t('schedule.title')}>{null}</WidgetCard>
        </div>
        <div className="md:col-span-5">
          <ChecklistWidget initial={data.checklist} />
        </div>
        <div className="md:col-span-12">
          <WidgetCard title={t('kanban.title')}>{null}</WidgetCard>
        </div>

        {/* ── 탐색 · 영감 ── */}
        <h2 className="mt-4 text-lg font-semibold md:col-span-12">{t('dashboard.explore')}</h2>
        {isYouTube && (
          <div className="md:col-span-8">
            <WidgetCard title={t('trends.title')}>{null}</WidgetCard>
          </div>
        )}
        <div className={isYouTube ? 'md:col-span-4' : 'md:col-span-6'}>
          <WidgetCard title={t('ideas.title')}>{null}</WidgetCard>
        </div>
        <div className="md:col-span-6">
          <WidgetCard title={t('references.title')}>{null}</WidgetCard>
        </div>
        <div className={isYouTube ? 'md:col-span-6' : 'md:col-span-4'}>
          <WidgetCard title={t('hashtags.title')}>{null}</WidgetCard>
        </div>
        <div className={isYouTube ? 'md:col-span-8' : 'md:col-span-4'}>
          <WidgetCard title={t('memo.title')}>{null}</WidgetCard>
        </div>
        <div className="md:col-span-4">
          <WidgetCard title={t('performance.title')}>
            <p className="text-sm text-gray-500">{t('performance.comingSoon')}</p>
          </WidgetCard>
        </div>
      </div>
    </WorkspaceRealtime>
  )
}
