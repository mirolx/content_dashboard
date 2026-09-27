import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WidgetCard } from '@/components/WidgetCard'
import { LanguageToggle } from '@/features/settings/LanguageToggle'
import { WorkspaceNameForm } from '@/features/settings/WorkspaceNameForm'
import { WorkspaceRealtime } from '@/lib/realtime/WorkspaceRealtime'
import { isPlatform } from '@/lib/types'
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
      </div>
    </WorkspaceRealtime>
  )
}
