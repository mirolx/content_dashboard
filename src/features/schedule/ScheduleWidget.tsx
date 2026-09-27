'use client'

import { useState, type FormEvent } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { WidgetCard } from '@/components/WidgetCard'
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
      id: crypto.randomUUID(),
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
    <WidgetCard title={t('title')} error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
        <input
          aria-label={t('titleLabel')}
          placeholder={t('titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <select
          aria-label={t('kindLabel')}
          value={kind}
          onChange={(e) => setKind(e.target.value as ScheduleKind)}
          className="rounded border border-gray-300 px-2 py-1"
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
          className="rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.id} className={`flex items-center gap-2 ${row.is_done ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                aria-label={tc('done')}
                checked={row.is_done}
                onChange={(e) => void update(row, { is_done: e.target.checked })}
              />
              <span className="rounded bg-gray-100 px-1 text-xs">{t(`kinds.${row.kind}`)}</span>
              <span className="shrink-0 text-xs text-gray-600">
                {format.dateTime(new Date(row.scheduled_at), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              <EditableText
                label={t('titleLabel')}
                value={row.title}
                onSave={(v) => update(row, { title: v })}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() =>
                  void mutate({ type: 'DELETE', id: row.id }, () => scheduleData.remove(row.id))
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
