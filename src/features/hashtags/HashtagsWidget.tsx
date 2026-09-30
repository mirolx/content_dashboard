'use client'

import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fieldClass } from '@/components/ui/field'
import { Tag } from '@/components/ui/tag'
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
    <Card
      tone="dark"
      title={t('title')}
      error={duplicate ? t('duplicate') : error ? tc('saveFailed') : null}
    >
      <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
        <input
          aria-label={t('tagLabel')}
          placeholder={`#${t('tagLabel')}`}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className={`${fieldClass} min-w-0 flex-1`}
        />
        <input
          aria-label={t('groupLabel')}
          placeholder={t('groupLabel')}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className={`${fieldClass} w-32`}
        />
        <Button type="submit" size="sm">
          {tc('add')}
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm opacity-60">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groupNames.map((name) => (
            <div key={name}>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-60">{name || t('ungrouped')}</h4>
              <ul className="flex flex-wrap gap-1">
                {groups.get(name)!.map((row) => (
                  <li key={row.id}>
                    <Tag>
                      #{row.tag}
                      <IconButton
                        label={`${tc('delete')} #${row.tag}`}
                        className="h-5 w-5 border-0"
                        onClick={() =>
                          void mutate({ type: 'DELETE', id: row.id }, () => hashtagsData.remove(row.id))
                        }
                      >
                        <X className="h-3 w-3" />
                      </IconButton>
                    </Tag>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
