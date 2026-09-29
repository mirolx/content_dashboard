'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { BenchmarkChannel } from '@/lib/types'
import { addBenchmarkChannel, type AddChannelError } from './channelActions'
import { channelsData } from './channelData'

const byCreated = (a: BenchmarkChannel, b: BenchmarkChannel) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

export function ChannelSettings({ initial }: { initial: BenchmarkChannel[] }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('benchmark_channels', initial, byCreated)
  const [input, setInput] = useState('')
  const [addError, setAddError] = useState<AddChannelError | null>(null)
  const [adding, startAdd] = useTransition()

  function add(e: FormEvent) {
    e.preventDefault()
    const value = input.trim()
    if (!value) return
    setAddError(null)
    startAdd(async () => {
      const result = await addBenchmarkChannel(workspaceId, value)
      if ('error' in result) {
        setAddError(result.error)
        return
      }
      setInput('')
      // 서버에서 이미 저장됐다 — 화면에만 바로 반영한다. 뒤이어 오는 Realtime 이벤트는 같은 id라 중복되지 않는다.
      void mutate({ type: 'INSERT', row: result.row }, async () => ({ error: null }))
    })
  }

  const message = addError ? t(`channelErrors.${addError}`) : error ? tc('saveFailed') : null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">{t('channelsHelp')}</p>

      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          aria-label={t('channelLabel')}
          placeholder={t('channelLabel')}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setAddError(null)
          }}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded bg-gray-900 px-3 py-1 text-white disabled:opacity-50"
        >
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('channelsEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-sm">
              {row.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.thumbnail_url} alt="" className="h-6 w-6 rounded-full" />
              )}
              <span className="font-medium">{row.title}</span>
              {row.handle && <span className="text-gray-500">@{row.handle}</span>}
              <button
                type="button"
                aria-label={`${tc('delete')} ${row.title}`}
                onClick={() =>
                  void mutate({ type: 'DELETE', id: row.id }, () => channelsData.remove(row.id))
                }
                className="ml-auto text-gray-400 hover:text-red-600"
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
