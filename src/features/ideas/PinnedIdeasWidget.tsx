'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fieldClass } from '@/components/ui/field'
import { newId } from '@/lib/id'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { PinnedIdea } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { ideasData } from './data'

const byNewest = (a: PinnedIdea, b: PinnedIdea) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

export function PinnedIdeasWidget({ initial }: { initial: PinnedIdea[] }) {
  const t = useTranslations('ideas')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('pinned_ideas', initial, byNewest)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = textSchema.safeParse(title)
    if (!parsed.success) return
    const row: PinnedIdea = {
      id: newId(),
      workspace_id: workspaceId,
      title: parsed.data,
      note: note.trim(),
      source_url: null,
      thumbnail_url: null,
      created_at: new Date().toISOString(),
    }
    setTitle('')
    setNote('')
    void mutate({ type: 'INSERT', row }, () => ideasData.insert(row))
  }

  function update(row: PinnedIdea, patch: Partial<PinnedIdea>) {
    return mutate({ type: 'UPDATE', row: { ...row, ...patch } }, () =>
      ideasData.update(row.id, patch),
    )
  }

  return (
    <Card title={t('title')} tone="dark" error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-3 flex flex-col gap-2">
        <input
          aria-label={t('titleLabel')}
          placeholder={t('titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClass}
        />
        <div className="flex gap-2">
          <input
            aria-label={t('noteLabel')}
            placeholder={t('noteLabel')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <Button type="submit" size="sm">
            {tc('add')}
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm opacity-60">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex gap-2 rounded-2xl border border-current/15 p-3">
              {row.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.thumbnail_url} alt="" className="h-12 w-20 shrink-0 rounded-xl object-cover" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <EditableText
                  label={t('titleLabel')}
                  value={row.title}
                  onSave={(v) => update(row, { title: v })}
                  className="text-sm font-medium"
                />
                {row.note && <p className="text-xs opacity-60">{row.note}</p>}
                <div className="flex items-center gap-2 text-xs">
                  {row.source_url && (
                    <a href={row.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {t('source')}
                    </a>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    magnetic={false}
                    onClick={() =>
                      void mutate({ type: 'DELETE', id: row.id }, () => ideasData.remove(row.id))
                    }
                    className="ml-auto"
                  >
                    {tc('delete')}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
