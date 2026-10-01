import { describe, expect, it } from 'vitest'
import type { VideoDetail } from '@/lib/youtube/api'
import { diverseOrder, pickTrends } from './pickTrends'

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
  tags: [],
  description: '',
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

const m = (id: string, matched: string[]) => ({ ...v(id), matched })
const groups: Record<string, string> = { 'living alone': 'solo', alone: 'solo', storytelling: 'story', 'glow up': 'growth' }
const groupOf = (k: string) => groups[k] ?? k

describe('diverseOrder', () => {
  it('moves videos whose top group already appeared to the back', () => {
    const list = [m('a', ['living alone']), m('b', ['alone']), m('c', ['storytelling']), m('d', ['glow up'])]
    expect(diverseOrder(list, groupOf).map((x) => x.videoId)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('puts videos without matches after the varied ones, keeping order', () => {
    const list = [m('a', ['living alone']), m('z', []), m('b', ['alone']), m('c', ['storytelling'])]
    expect(diverseOrder(list, groupOf).map((x) => x.videoId)).toEqual(['a', 'c', 'z', 'b'])
  })
})

describe('pickTrends with groupOf', () => {
  it('prefers different groups and fills with the rest when short', () => {
    const channel = [m('c0', ['living alone']), m('c1', ['alone']), m('c2', ['living alone']), m('c3', ['storytelling'])]
    const result = pickTrends(channel, [], { groupOf, perSource: 2, total: 3 })
    expect(ids(result)).toEqual(['c:c0', 'c:c3', 'c:c1'])
  })
})
