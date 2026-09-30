'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, IconButton } from '@/components/ui/button'
import { fieldClass } from '@/components/ui/field'
import { Tag } from '@/components/ui/tag'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { TrendKeyword } from '@/lib/types'
import { keywordsData } from './data'
import { addKeywords, type AddKeywordsError } from './keywordActions'

const byKeyword = (a: TrendKeyword, b: TrendKeyword) => a.keyword.localeCompare(b.keyword)

type Notice =
  | { kind: 'added'; added: number; skipped: number; truncated: number }
  | { kind: 'error'; error: AddKeywordsError }

export function KeywordSettings({ initial }: { initial: TrendKeyword[] }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('trend_keywords', initial, byKeyword)
  const [group, setGroup] = useState('')
  const [text, setText] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [adding, startAdd] = useTransition()

  const groupNames = [...new Set(rows.map((r) => r.group_name).filter((g): g is string => !!g))].sort(
    (a, b) => a.localeCompare(b),
  )
  const allSections: [string | null, TrendKeyword[]][] = [
    ...groupNames.map((g): [string | null, TrendKeyword[]] => [g, rows.filter((r) => r.group_name === g)]),
    [null, rows.filter((r) => !r.group_name)],
  ]
  const sections = allSections.filter(([, list]) => list.length > 0)

  function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setNotice(null)
    startAdd(async () => {
      const result = await addKeywords(workspaceId, group, text)
      if ('error' in result) {
        setNotice({ kind: 'error', error: result.error })
        return
      }
      setText('')
      setNotice({ kind: 'added', added: result.added, skipped: result.skipped, truncated: result.truncated })
      // 서버에서 이미 저장됐다 — 화면에만 바로 반영한다. 뒤이어 오는 Realtime 이벤트는 같은 id라 중복되지 않는다.
      for (const row of result.rows) void mutate({ type: 'INSERT', row }, async () => ({ error: null }))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm opacity-60">{t('keywordsHelp')}</p>

      {notice?.kind === 'error' && (
        <p role="alert" className="text-sm text-danger">
          {t(`keywordErrors.${notice.error}`)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {tc('saveFailed')}
        </p>
      )}
      {notice?.kind === 'added' && (
        <p role="status" className="text-sm font-medium opacity-80">
          {t('keywordsAdded', { added: notice.added, skipped: notice.skipped })}
          {notice.truncated > 0 && ` ${t('keywordsTruncated', { count: notice.truncated })}`}
        </p>
      )}

      <form onSubmit={add} className="flex flex-col gap-2">
        <input
          aria-label={t('keywordGroupLabel')}
          placeholder={t('keywordGroupLabel')}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          list="keyword-groups"
          maxLength={30}
          className={fieldClass}
        />
        <datalist id="keyword-groups">
          {groupNames.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <textarea
          aria-label={t('keywordLabel')}
          placeholder={t('keywordsPlaceholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (notice?.kind === 'error') setNotice(null)
          }}
          rows={3}
          className={fieldClass}
        />
        <Button type="submit" size="sm" variant="primary" disabled={adding} className="self-end">
          {tc('add')}
        </Button>
      </form>

      {sections.length === 0 ? (
        <p className="text-sm opacity-60">{t('keywordsEmpty')}</p>
      ) : (
        sections.map(([name, list]) => (
          <div key={name ?? '__none__'}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-60">
              {name ?? t('ungroupedKeywords')} <span className="opacity-60">{list.length}</span>
            </h4>
            <ul className="flex flex-wrap gap-1">
              {list.map((row) => (
                <li key={row.id}>
                  <Tag>
                    {row.keyword}
                    <IconButton
                      label={`${tc('delete')} ${row.keyword}`}
                      onClick={() =>
                        void mutate({ type: 'DELETE', id: row.id }, () => keywordsData.remove(row.id))
                      }
                      className="h-5 w-5 border-0"
                    >
                      <X className="h-3 w-3" />
                    </IconButton>
                  </Tag>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
