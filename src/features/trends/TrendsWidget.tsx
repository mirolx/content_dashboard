'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { WidgetCard } from '@/components/WidgetCard'
import { ideasData } from '@/features/ideas/data'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { TrendsResult } from '@/lib/trends/getTodayTrends'
import type { PinnedIdea, TrendTopic } from '@/lib/types'
import { videoUrl } from '@/lib/youtube/videoUrl'

export function TrendsWidget({
  result,
  pinnedUrls,
}: {
  result: TrendsResult
  pinnedUrls: string[]
}) {
  const t = useTranslations('trends')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const [pinned, setPinned] = useState(() => new Set(pinnedUrls))
  const [pinFailed, setPinFailed] = useState(false)

  async function pin(topic: TrendTopic) {
    const url = videoUrl(topic.video_id)
    setPinned((prev) => new Set(prev).add(url))
    setPinFailed(false)
    const row: PinnedIdea = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      title: topic.title,
      note: topic.channel_title,
      source_url: url,
      thumbnail_url: topic.thumbnail_url || null,
      created_at: new Date().toISOString(),
    }
    // 고정된 아이디어 위젯에는 Realtime INSERT 이벤트로 나타난다.
    const { error } = await ideasData.insert(row)
    if (error) {
      setPinned((prev) => {
        const next = new Set(prev)
        next.delete(url)
        return next
      })
      setPinFailed(true)
    }
  }

  if (result.status === 'no-keywords') {
    return (
      <WidgetCard title={t('title')}>
        <p className="text-sm text-gray-600">
          {t('noKeywords')}{' '}
          <Link href="/youtube/settings" className="underline">
            {t('goToSettings')}
          </Link>
        </p>
      </WidgetCard>
    )
  }

  const topics = result.status === 'ok' ? result.topics : result.fallback

  return (
    <WidgetCard title={t('title')} error={pinFailed ? tc('saveFailed') : null}>
      {result.status === 'failed' && (
        <p role="status" className="mb-2 text-sm text-amber-700">
          {t('failed')} {result.fetchedOn && t('showingFrom', { date: result.fetchedOn })}
        </p>
      )}

      {topics.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {topics.map((topic) => {
            const url = videoUrl(topic.video_id)
            const isPinned = pinned.has(url)
            return (
              <li key={topic.id} className="flex gap-2">
                {topic.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={topic.thumbnail_url} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-2 text-sm font-medium hover:underline"
                  >
                    {topic.title}
                  </a>
                  <p className="text-xs text-gray-600">
                    {topic.channel_title} · {t('views', { count: topic.view_count })}
                  </p>
                  <button
                    type="button"
                    disabled={isPinned}
                    onClick={() => void pin(topic)}
                    className="mt-1 text-xs underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {isPinned ? t('pinned') : t('pin')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </WidgetCard>
  )
}
