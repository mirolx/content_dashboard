'use client'

import { useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, FileText, Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fieldClass } from '@/components/ui/field'
import { newId } from '@/lib/id'
import { positionAfter } from '@/lib/position'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { KANBAN_STATUSES, type KanbanCard, type KanbanStatus } from '@/lib/types'
import { notionUrlSchema, textSchema } from '@/lib/validation'
import { kanbanData } from './data'

const byPosition = (a: KanbanCard, b: KanbanCard) => a.position - b.position

export function KanbanWidget({ initial }: { initial: KanbanCard[] }) {
  const t = useTranslations('kanban')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('kanban_cards', initial, byPosition)
  const [title, setTitle] = useState('')
  /** Notion 링크를 편집 중인 카드 */
  const [notionEditing, setNotionEditing] = useState<{ id: string; draft: string; invalid: boolean } | null>(null)

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
      notion_url: null,
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

  function saveNotion(e: FormEvent, card: KanbanCard) {
    e.preventDefault()
    if (!notionEditing) return
    const parsed = notionUrlSchema.safeParse(notionEditing.draft)
    if (!parsed.success) {
      setNotionEditing({ ...notionEditing, invalid: true })
      return
    }
    setNotionEditing(null)
    if (parsed.data !== card.notion_url) void update(card, { notion_url: parsed.data })
  }

  function shift(card: KanbanCard, dir: -1 | 1) {
    const target = KANBAN_STATUSES[KANBAN_STATUSES.indexOf(card.status) + dir]
    if (!target) return
    void update(card, { status: target, position: endOf(target) })
  }

  return (
    <Card title={t('title')} tone="dark" error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          aria-label={t('cardLabel')}
          placeholder={t('cardLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${fieldClass} flex-1`}
        />
        <Button type="submit" size="sm" variant="primary">
          {tc('add')}
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {KANBAN_STATUSES.map((status, col) => {
          const cards = rows.filter((r) => r.status === status)
          return (
            <div key={status} className="rounded-2xl bg-ink p-3">
              <h4 className={`mb-2 text-sm font-bold ${cards.length > 0 ? 'text-accent' : 'text-muted'}`}>
                {t(`statuses.${status}`)} <span className="opacity-60">{cards.length}</span>
              </h4>
              {cards.length === 0 ? (
                <p className="text-xs opacity-50">{t('emptyColumn')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cards.map((card) => (
                    <li key={card.id} className="rounded-xl bg-cream p-3 text-ink">
                      <EditableText
                        label={t('cardLabel')}
                        value={card.title}
                        onSave={(v) => update(card, { title: v })}
                        className="w-full text-sm"
                      />
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                        <IconButton label={tc('moveLeft')} disabled={col === 0} onClick={() => shift(card, -1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={tc('moveRight')}
                          disabled={col === KANBAN_STATUSES.length - 1}
                          onClick={() => shift(card, 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </IconButton>
                        {card.notion_url && (
                          <a
                            href={card.notion_url}
                            target="_blank"
                            rel="noreferrer"
                            data-magnetic
                            aria-label={t('notionOpen')}
                            className="inline-flex h-7 items-center gap-1 rounded-full bg-ink px-2.5 text-[11px] font-semibold text-cream transition-colors hover:bg-ink/85"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Notion
                          </a>
                        )}
                        <IconButton
                          label={card.notion_url ? t('notionEdit') : t('notionLink')}
                          onClick={() =>
                            setNotionEditing(
                              notionEditing?.id === card.id
                                ? null
                                : { id: card.id, draft: card.notion_url ?? '', invalid: false },
                            )
                          }
                        >
                          {card.notion_url ? <Pencil className="h-3.5 w-3.5" /> : <FileText className="h-4 w-4" />}
                        </IconButton>
                        <Button
                          variant="danger"
                          size="sm"
                          magnetic={false}
                          onClick={() =>
                            void mutate({ type: 'DELETE', id: card.id }, () =>
                              kanbanData.remove(card.id),
                            )
                          }
                          className="ml-auto"
                        >
                          {tc('delete')}
                        </Button>
                      </div>
                      {notionEditing?.id === card.id && (
                        <form onSubmit={(e) => saveNotion(e, card)} className="mt-2 flex flex-col gap-2">
                          <input
                            autoFocus
                            aria-label={t('notionLink')}
                            placeholder={t('notionPlaceholder')}
                            value={notionEditing.draft}
                            onChange={(e) => setNotionEditing({ ...notionEditing, draft: e.target.value, invalid: false })}
                            className={`${fieldClass} w-full text-xs`}
                          />
                          {notionEditing.invalid && (
                            <p role="alert" className="text-xs font-medium">
                              {t('notionInvalid')}
                            </p>
                          )}
                          <div className="flex gap-1">
                            <Button type="submit" size="sm" variant="ink">
                              {t('notionSave')}
                            </Button>
                            <Button size="sm" variant="ghost" magnetic={false} onClick={() => setNotionEditing(null)}>
                              {t('notionCancel')}
                            </Button>
                          </div>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
