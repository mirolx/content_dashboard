'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { WidgetCard } from '@/components/WidgetCard'
import { newId } from '@/lib/id'
import { positionAfter } from '@/lib/position'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { KANBAN_STATUSES, type KanbanCard, type KanbanStatus } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { kanbanData } from './data'

const byPosition = (a: KanbanCard, b: KanbanCard) => a.position - b.position

export function KanbanWidget({ initial }: { initial: KanbanCard[] }) {
  const t = useTranslations('kanban')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('kanban_cards', initial, byPosition)
  const [title, setTitle] = useState('')

  const endOf = (status: KanbanStatus) =>
    positionAfter(rows.filter((r) => r.status === status).map((r) => r.position))

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = textSchema.safeParse(title)
    if (!parsed.success) return
    const row: KanbanCard = {
      id: newId(),
      workspace_id: workspaceId,
      title: parsed.data,
      status: 'shot',
      position: endOf('shot'),
      created_at: new Date().toISOString(),
    }
    setTitle('')
    void mutate({ type: 'INSERT', row }, () => kanbanData.insert(row))
  }

  function update(card: KanbanCard, patch: Partial<KanbanCard>) {
    return mutate({ type: 'UPDATE', row: { ...card, ...patch } }, () =>
      kanbanData.update(card.id, patch),
    )
  }

  function shift(card: KanbanCard, dir: -1 | 1) {
    const target = KANBAN_STATUSES[KANBAN_STATUSES.indexOf(card.status) + dir]
    if (!target) return
    void update(card, { status: target, position: endOf(target) })
  }

  return (
    <WidgetCard title={t('title')} error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <input
          aria-label={t('cardLabel')}
          placeholder={t('cardLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {KANBAN_STATUSES.map((status, col) => {
          const cards = rows.filter((r) => r.status === status)
          return (
            <div key={status} className="rounded bg-gray-50 p-2">
              <h4 className="mb-2 text-sm font-medium">
                {t(`statuses.${status}`)} <span className="text-gray-500">{cards.length}</span>
              </h4>
              {cards.length === 0 ? (
                <p className="text-xs text-gray-400">{t('emptyColumn')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cards.map((card) => (
                    <li key={card.id} className="rounded border border-gray-300 bg-white p-2">
                      <EditableText
                        label={t('cardLabel')}
                        value={card.title}
                        onSave={(v) => update(card, { title: v })}
                        className="w-full text-sm"
                      />
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          aria-label={tc('moveLeft')}
                          disabled={col === 0}
                          onClick={() => shift(card, -1)}
                          className="px-1 disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label={tc('moveRight')}
                          disabled={col === KANBAN_STATUSES.length - 1}
                          onClick={() => shift(card, 1)}
                          className="px-1 disabled:opacity-30"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void mutate({ type: 'DELETE', id: card.id }, () =>
                              kanbanData.remove(card.id),
                            )
                          }
                          className="ml-auto text-red-600"
                        >
                          {tc('delete')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </WidgetCard>
  )
}
