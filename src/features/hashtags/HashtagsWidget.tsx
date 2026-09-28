'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { WidgetCard } from '@/components/WidgetCard'
import { newId } from '@/lib/id'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { Hashtag } from '@/lib/types'
import { normalizeTag } from '@/lib/validation'
import { hashtagsData } from './data'

const byTag = (a: Hashtag, b: Hashtag) => a.tag.localeCompare(b.tag)

export function HashtagsWidget({ initial }: { initial: Hashtag[] }) {
  const t = useTranslations('hashtags')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('hashtags', initial, byTag)
  const [tag, setTag] = useState('')
  const [group, setGroup] = useState('')
  const [duplicate, setDuplicate] = useState(false)

  function add(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizeTag(tag)
    if (!normalized || normalized.length > 100) return
    if (rows.some((r) => r.tag === normalized)) {
      setDuplicate(true)
      return
    }
    setDuplicate(false)
    const row: Hashtag = {
      id: newId(),
      workspace_id: workspaceId,
      tag: normalized,
      group_name: group.trim() || null,
      created_at: new Date().toISOString(),
    }
    setTag('')
    void mutate({ type: 'INSERT', row }, () => hashtagsData.insert(row))
  }

  const groups = new Map<string, Hashtag[]>()
  for (const row of rows) {
    const key = row.group_name ?? ''
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const groupNames = [...groups.keys()].sort((a, b) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
  )

  return (
    <WidgetCard
      title={t('title')}
      error={duplicate ? t('duplicate') : error ? tc('saveFailed') : null}
    >
      <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
        <input
          aria-label={t('tagLabel')}
          placeholder={`#${t('tagLabel')}`}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <input
          aria-label={t('groupLabel')}
          placeholder={t('groupLabel')}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="w-32 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groupNames.map((name) => (
            <div key={name}>
              <h4 className="mb-1 text-xs font-medium text-gray-500">{name || t('ungrouped')}</h4>
              <ul className="flex flex-wrap gap-1">
                {groups.get(name)!.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-sm"
                  >
                    #{row.tag}
                    <button
                      type="button"
                      aria-label={`${tc('delete')} #${row.tag}`}
                      onClick={() =>
                        void mutate({ type: 'DELETE', id: row.id }, () => hashtagsData.remove(row.id))
                      }
                      className="text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
