import { describe, expect, it } from 'vitest'
import type { VideoDetail } from '@/lib/youtube/api'
import { pickTrends } from './pickTrends'

const v = (id: string): VideoDetail => ({
  videoId: id,
  title: id,
  channelId: 'UC',
  channelTitle: 'C',
  viewCount: 0,
  thumbnailUrl: '',
  durationSec: 600,
  categoryId: '22',
  publishedAt: '2026-09-25T00:00:00Z',
})
const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => v(`${prefix}${i}`))
const ids = (list: { videoId: string; source: string }[]) => list.map((x) => `${x.source[0]}:${x.videoId}`)

describe('pickTrends', () => {
  it('takes 4 from each source in order', () => {
    const result = pickTrends(many('c', 6), many('k', 6))
    expect(ids(result)).toEqual(['c:c0', 'c:c1', 'c:c2', 'c:c3', 'k:k0', 'k:k1', 'k:k2', 'k:k3'])
  })

  it('fills from keywords when channels are short', () => {
    const result = pickTrends(many('c', 1), many('k', 10))
    expect(ids(result)).toEqual(['c:c0', 'k:k0', 'k:k1', 'k:k2', 'k:k3', 'k:k4', 'k:k5', 'k:k6'])
  })

  it('fills from channels when keywords are short', () => {
    const result = pickTrends(many('c', 10), many('k', 2))
    expect(ids(result)).toEqual(['c:c0', 'c:c1', 'c:c2', 'c:c3', 'c:c4', 'c:c5', 'k:k0', 'k:k1'])
  })

  it('returns what exists when both are short', () => {
    expect(ids(pickTrends(many('c', 2), many('k', 1)))).toEqual(['c:c0', 'c:c1', 'k:k0'])
    expect(pickTrends([], [])).toEqual([])
  })

  it('keeps a video found by both only in the channel group', () => {
    const result = pickTrends([v('same'), v('c1')], [v('same'), v('k1')])
    expect(ids(result)).toEqual(['c:same', 'c:c1', 'k:k1'])
  })

  it('drops a keyword duplicate only when the channel copy is actually picked', () => {
    const result = pickTrends([...many('c', 5), v('shared')], [v('shared'), ...many('k', 5)])
    expect(ids(result)).toEqual(['c:c0', 'c:c1', 'c:c2', 'c:c3', 'k:shared', 'k:k0', 'k:k1', 'k:k2'])
  })
})
