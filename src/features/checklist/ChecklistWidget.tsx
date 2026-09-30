'use client'

import { useState, type FormEvent } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fieldClass } from '@/components/ui/field'
import { newId } from '@/lib/id'
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
      id: newId(),
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
    <Card title={t('title')} tone="accent" error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          aria-label={t('itemLabel')}
          placeholder={t('itemLabel')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={`${fieldClass} flex-1`}
        />
        <Button type="submit" size="sm" variant="ink">
          {tc('add')}
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm opacity-60">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li key={row.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={tc('done')}
                checked={row.is_done}
                onChange={(e) => void update(row, { is_done: e.target.checked })}
                className="h-4 w-4 accent-ink"
              />
              <EditableText
                label={t('itemLabel')}
                value={row.content}
                onSave={(v) => update(row, { content: v })}
                className={`flex-1 text-sm ${row.is_done ? 'line-through opacity-50' : ''}`}
              />
              <IconButton label={tc('moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                <ChevronUp className="h-4 w-4" />
              </IconButton>
              <IconButton label={tc('moveDown')} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <ChevronDown className="h-4 w-4" />
              </IconButton>
              <Button
                variant="danger"
                size="sm"
                magnetic={false}
                onClick={() => void mutate({ type: 'DELETE', id: row.id }, () => checklistData.remove(row.id))}
              >
                {tc('delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
