'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { newId } from '@/lib/id'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { TrendKeyword } from '@/lib/types'
import { keywordsData } from './data'

const byKeyword = (a: TrendKeyword, b: TrendKeyword) => a.keyword.localeCompare(b.keyword)

export function KeywordSettings({ initial }: { initial: TrendKeyword[] }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('trend_keywords', initial, byKeyword)
  const [keyword, setKeyword] = useState('')
  const [duplicate, setDuplicate] = useState(false)

  function add(e: FormEvent) {
    e.preventDefault()
    const value = keyword.trim().replace(/\s+/g, ' ')
    if (!value || value.length > 60) return
    if (rows.some((r) => r.keyword.toLowerCase() === value.toLowerCase())) {
      setDuplicate(true)
      return
    }
    setDuplicate(false)
    const row: TrendKeyword = {
      id: newId(),
      workspace_id: workspaceId,
      keyword: value,
      created_at: new Date().toISOString(),
      group_name: null,
      last_searched_on: null,
    }
    setKeyword('')
    void mutate({ type: 'INSERT', row }, () => keywordsData.insert(row))
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">{t('keywordsHelp')}</p>

      {(duplicate || error) && (
        <p role="alert" className="text-sm text-red-600">
          {duplicate ? t('keywordDuplicate') : tc('saveFailed')}
        </p>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          aria-label={t('keywordLabel')}
          placeholder={t('keywordLabel')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('keywordsEmpty')}</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-sm"
            >
              {row.keyword}
              <button
                type="button"
                aria-label={`${tc('delete')} ${row.keyword}`}
                onClick={() =>
                  void mutate({ type: 'DELETE', id: row.id }, () => keywordsData.remove(row.id))
                }
                className="text-gray-400 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
