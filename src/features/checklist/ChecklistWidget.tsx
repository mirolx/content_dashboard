'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { WidgetCard } from '@/components/WidgetCard'
import { positionAfter, positionBetween } from '@/lib/position'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { ChecklistItem } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { checklistData } from './data'

const byPosition = (a: ChecklistItem, b: ChecklistItem) => a.position - b.position

export function ChecklistWidget({ initial }: { initial: ChecklistItem[] }) {
  const t = useTranslations('checklist')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('checklist_items', initial, byPosition)
  const [content, setContent] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = textSchema.safeParse(content)
    if (!parsed.success) return
    const row: ChecklistItem = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      content: parsed.data,
      is_done: false,
      position: positionAfter(rows.map((r) => r.position)),
      created_at: new Date().toISOString(),
    }
    setContent('')
    void mutate({ type: 'INSERT', row }, () => checklistData.insert(row))
  }

  function update(row: ChecklistItem, patch: Partial<ChecklistItem>) {
    return mutate({ type: 'UPDATE', row: { ...row, ...patch } }, () =>
      checklistData.update(row.id, patch),
    )
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= rows.length) return
    const position =
      dir === -1
        ? positionBetween(rows[target - 1]?.position, rows[target].position)
        : positionBetween(rows[target].position, rows[target + 1]?.position)
    void update(rows[index], { position })
  }

  return (
    <WidgetCard title={t('title')} error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <input
          aria-label={t('itemLabel')}
          placeholder={t('itemLabel')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row, i) => (
            <li key={row.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={tc('done')}
                checked={row.is_done}
                onChange={(e) => void update(row, { is_done: e.target.checked })}
              />
              <EditableText
                label={t('itemLabel')}
                value={row.content}
                onSave={(v) => update(row, { content: v })}
                className={`flex-1 ${row.is_done ? 'text-gray-400 line-through' : ''}`}
              />
              <button
                type="button"
                aria-label={tc('moveUp')}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="px-1 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={tc('moveDown')}
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
                className="px-1 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() =>
                  void mutate({ type: 'DELETE', id: row.id }, () => checklistData.remove(row.id))
                }
                className="text-sm text-red-600"
              >
                {tc('delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
