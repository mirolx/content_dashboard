'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tag } from '@/components/ui/tag'
import { ideasData } from '@/features/ideas/data'
import { newId } from '@/lib/id'
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
      id: newId(),
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

  if (result.status === 'no-sources') {
    return (
      <Card tone="cream" title={t('title')}>
        <p className="text-sm opacity-60">
          {t('noSources')}{' '}
          <Link href="/youtube/settings" className="underline underline-offset-2">
            {t('goToSettings')}
          </Link>
        </p>
      </Card>
    )
  }

  const topics = result.status === 'ok' ? result.topics : result.fallback
  const groups = [
    { key: 'channel', title: t('fromChannels'), items: topics.filter((x) => x.source === 'channel') },
    { key: 'keyword', title: t('fromKeywords'), items: topics.filter((x) => x.source !== 'channel') },
  ].filter((g) => g.items.length > 0)

  function renderTopic(topic: TrendTopic) {
    const url = videoUrl(topic.video_id)
    const isPinned = pinned.has(url)
    return (
      <li key={topic.id} className="flex gap-2">
        {topic.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={topic.thumbnail_url} alt="" className="h-16 w-28 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <a href={url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold hover:underline">
            {topic.title}
          </a>
          <p className="text-xs opacity-60">
            {topic.channel_title} · {t('views', { count: topic.view_count })}
          </p>
          {topic.matched_keywords.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {topic.matched_keywords.slice(0, 3).map((keyword) => (
                <Tag key={keyword} tone="accent">{keyword}</Tag>
              ))}
            </div>
          )}
          <Button size="sm" variant="ghost" disabled={isPinned} onClick={() => void pin(topic)} className="mt-2">
            {isPinned ? t('pinned') : t('pin')}
          </Button>
        </div>
      </li>
    )
  }

  return (
    <Card
      tone="cream"
      title={t('title')}
      error={pinFailed ? tc('saveFailed') : null}
      action={
        <Link
          href="/youtube/settings"
          data-magnetic
          aria-label={t('goToSettings')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/30 transition hover:border-current/70"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      }
    >
      {result.status === 'failed' && (
        <p role="status" className="mb-2 text-sm font-medium text-danger">
          {t('failed')} {result.fetchedOn && t('showingFrom', { date: result.fetchedOn })}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-sm opacity-60">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.key}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-60">{group.title}</h4>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{group.items.map(renderTopic)}</ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}
