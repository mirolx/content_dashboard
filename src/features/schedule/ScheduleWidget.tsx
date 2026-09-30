'use client'

import { useState, type FormEvent } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fieldClass, selectClass } from '@/components/ui/field'
import { Tag } from '@/components/ui/tag'
import { newId } from '@/lib/id'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { SCHEDULE_KINDS, type ScheduleItem, type ScheduleKind } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { scheduleData } from './data'

// DB(+00:00)와 클라이언트(Z)의 ISO 표기가 달라 문자열이 아닌 시각으로 비교한다.
const byDate = (a: ScheduleItem, b: ScheduleItem) =>
  new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()

export function ScheduleWidget({ initial }: { initial: ScheduleItem[] }) {
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const format = useFormatter()
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('schedule_items', initial, byDate)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ScheduleKind>('upload')
  const [when, setWhen] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = textSchema.safeParse(title)
    if (!parsed.success || !when) return
    const row: ScheduleItem = {
      id: newId(),
      workspace_id: workspaceId,
      title: parsed.data,
      kind,
      // datetime-local 값은 브라우저 현지 시각 → UTC ISO로 저장
      scheduled_at: new Date(when).toISOString(),
      is_done: false,
      created_at: new Date().toISOString(),
    }
    setTitle('')
    setWhen('')
    void mutate({ type: 'INSERT', row }, () => scheduleData.insert(row))
  }

  function update(row: ScheduleItem, patch: Partial<ScheduleItem>) {
    return mutate({ type: 'UPDATE', row: { ...row, ...patch } }, () =>
      scheduleData.update(row.id, patch),
    )
  }

  return (
    <Card title={t('title')} tone="cream" error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-4 flex flex-wrap gap-2">
        <input
          aria-label={t('titleLabel')}
          placeholder={t('titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${fieldClass} flex-1`}
        />
        <select
          aria-label={t('kindLabel')}
          value={kind}
          onChange={(e) => setKind(e.target.value as ScheduleKind)}
          className={selectClass}
        >
          {SCHEDULE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          aria-label={t('whenLabel')}
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          required
          className={fieldClass}
        />
        <Button type="submit" size="sm" variant="primary">
          {tc('add')}
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.id} className={`flex flex-wrap items-center gap-2 ${row.is_done ? 'opacity-75' : ''}`}>
              <input
                type="checkbox"
                aria-label={tc('done')}
                checked={row.is_done}
                onChange={(e) => void update(row, { is_done: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
              <Tag>{t(`kinds.${row.kind}`)}</Tag>
              <span className="shrink-0 text-xs font-semibold opacity-70">
                {format.dateTime(new Date(row.scheduled_at), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              <EditableText
                label={t('titleLabel')}
                value={row.title}
                onSave={(v) => update(row, { title: v })}
                className="min-w-[8rem] flex-1"
              />
              <Button
                variant="danger"
                size="sm"
                magnetic={false}
                onClick={() =>
                  void mutate({ type: 'DELETE', id: row.id }, () => scheduleData.remove(row.id))
                }
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
