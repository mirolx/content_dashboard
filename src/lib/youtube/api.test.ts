import { describe, expect, it, vi } from 'vitest'
import { fetchVideoDetails, YouTubeApiError } from './api'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function raw(id: string) {
  return {
    id,
    snippet: {
      title: `Title ${id}`,
      channelId: 'UCchan',
      channelTitle: 'Chan',
      categoryId: '22',
      publishedAt: '2026-09-20T00:00:00Z',
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
    },
    statistics: { viewCount: '1234' },
    contentDetails: { duration: 'PT10M' },
  }
}

describe('fetchVideoDetails', () => {
  it('maps fields including duration, category and publish date', async () => {
    const fetchImpl = vi.fn(async () => json({ items: [raw('a')] }))
    const [v] = await fetchVideoDetails('k', ['a'], fetchImpl as unknown as typeof fetch)
    expect(v).toEqual({
      videoId: 'a',
      title: 'Title a',
      channelId: 'UCchan',
      channelTitle: 'Chan',
      viewCount: 1234,
      thumbnailUrl: 'https://i.ytimg.com/vi/a/mqdefault.jpg',
      durationSec: 600,
      categoryId: '22',
      publishedAt: '2026-09-20T00:00:00Z',
      tags: [],
      description: '',
    })
    const url = new URL(String((fetchImpl.mock.calls as unknown[][])[0][0]))
    expect(url.pathname).toMatch(/\/videos$/)
    expect(url.searchParams.get('part')).toBe('snippet,statistics,contentDetails')
    expect(url.searchParams.get('key')).toBe('k')
  })

  it('maps tags and truncates the description to 500 characters', async () => {
    const withText = {
      ...raw('b'),
      snippet: { ...raw('b').snippet, tags: ['glow up', 'vlog'], description: 'x'.repeat(600) },
    }
    const fetchImpl = vi.fn(async () => json({ items: [withText] }))
    const [v] = await fetchVideoDetails('k', ['b'], fetchImpl as unknown as typeof fetch)
    expect(v.tags).toEqual(['glow up', 'vlog'])
    expect(v.description).toHaveLength(500)
  })

  it('splits more than 50 ids into several calls', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `v${i}`)
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const requested = (new URL(String(input)).searchParams.get('id') ?? '').split(',')
      return json({ items: requested.map(raw) })
    })
    const result = await fetchVideoDetails('k', ids, fetchImpl as unknown as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(60)
  })

  it('returns [] without calling the API for no ids', async () => {
    const fetchImpl = vi.fn()
    expect(await fetchVideoDetails('k', [], fetchImpl as unknown as typeof fetch)).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws YouTubeApiError with the HTTP status', async () => {
    const fetchImpl = vi.fn(async () => json({ error: {} }, 403))
    await expect(fetchVideoDetails('k', ['a'], fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      name: 'YouTubeApiError',
      status: 403,
    })
    await expect(fetchVideoDetails('k', ['a'], fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(
      YouTubeApiError,
    )
  })
})
