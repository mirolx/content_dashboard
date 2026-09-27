'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { renameWorkspace } from './actions'

export function WorkspaceNameForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const t = useTranslations()
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  async function save(value: string) {
    const result = await renameWorkspace(workspaceId, value)
    const ok = 'ok' in result
    setFailed(!ok)
    if (ok) router.refresh()
    return ok
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>{t('settings.workspaceName')}</span>
      <EditableText
        label={t('settings.workspaceName')}
        value={name}
        onSave={save}
        className="border-gray-300"
      />
      {failed && (
        <span role="alert" className="text-red-600">
          {t('common.saveFailed')}
        </span>
      )}
    </div>
  )
}
