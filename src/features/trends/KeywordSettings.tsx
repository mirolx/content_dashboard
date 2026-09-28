'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { TrendKeyword } from '@/lib/types'
import { refetchTodayTrends } from './actions'
import { keywordsData } from './data'

const byKeyword = (a: TrendKeyword, b: TrendKeyword) => a.keyword.localeCompare(b.keyword)

export function KeywordSettings({ initial }: { initial: TrendKeyword[] }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('trend_keywords', initial, byKeyword)
  const [keyword, setKeyword] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  const [refetchState, setRefetchState] = useState<'idle' | 'done' | 'failed'>('idle')
  const [refetching, startRefetch] = useTransition()

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
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      keyword: value,
      created_at: new Date().toISOString(),
    }
    setKeyword('')
    void mutate({ type: 'INSERT', row }, () => keywordsData.insert(row))
  }

  function refetch() {
    setRefetchState('idle')
    startRefetch(async () => {
      const result = await refetchTodayTrends(workspaceId)
      setRefetchState('ok' in result ? 'done' : 'failed')
    })
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={refetch}
          disabled={refetching}
          className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
        >
          {t('refetch')}
        </button>
        <span aria-live="polite" className="text-sm">
          {refetchState === 'done' && t('refetchDone')}
          {refetchState === 'failed' && <span className="text-red-600">{t('refetchFailed')}</span>}
        </span>
      </div>
    </div>
  )
}
