import { describe, expect, it, vi } from 'vitest'
import { fetchTrends, YouTubeApiError } from './fetchTrends'

const now = new Date('2026-09-28T00:00:00Z')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function video(id: string, views: string) {
  return {
    id,
    snippet: {
      title: `Title ${id}`,
      channelTitle: `Channel ${id}`,
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
    },
    statistics: { viewCount: views },
  }
}

/** search는 키워드별 결과, videos는 요청한 id만 돌려주는 가짜 fetch */
function fakeYouTube(search: Record<string, string[]>, videos: ReturnType<typeof video>[]) {
  const fn = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/search')) {
      const ids = search[url.searchParams.get('q') ?? ''] ?? []
      return json({ items: ids.map((videoId) => ({ id: { videoId } })) })
    }
    if (url.pathname.endsWith('/videos')) {
      const ids = (url.searchParams.get('id') ?? '').split(',')
      return json({ items: videos.filter((v) => ids.includes(v.id)) })
    }
    return json({}, 404)
  })
  return fn
}

const calls = (fn: ReturnType<typeof fakeYouTube>, path: string) =>
  fn.mock.calls.map(([input]) => new URL(String(input))).filter((u) => u.pathname.endsWith(path))

describe('fetchTrends', () => {
  it('returns [] without calling the API when there are no keywords', async () => {
    const fetchImpl = fakeYouTube({}, [])
    const result = await fetchTrends({ apiKey: 'k', keywords: [], now, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('searches each keyword with the niche filters', async () => {
    const fetchImpl = fakeYouTube({ storytelling: ['a'], 'raw story': ['b'] }, [video('a', '1'), video('b', '2')])
    await fetchTrends({ apiKey: 'k', keywords: ['storytelling', 'raw story'], now, fetchImpl: fetchImpl as unknown as typeof fetch })

    const searches = calls(fetchImpl, '/search')
    expect(searches.map((u) => u.searchParams.get('q'))).toEqual(['storytelling', 'raw story'])
    const p = searches[0].searchParams
    expect(p.get('part')).toBe('snippet')
    expect(p.get('type')).toBe('video')
    expect(p.get('relevanceLanguage')).toBe('en')
    expect(p.get('regionCode')).toBe('US')
    expect(p.get('order')).toBe('viewCount')
    expect(p.get('maxResults')).toBe('10')
    expect(p.get('publishedAfter')).toBe('2026-09-21T00:00:00.000Z')
    expect(p.get('key')).toBe('k')
  })

  it('dedupes video ids across keywords and looks them up in one call', async () => {
    const fetchImpl = fakeYouTube({ a: ['x', 'y'], b: ['y', 'z'] }, [video('x', '1'), video('y', '2'), video('z', '3')])
    await fetchTrends({ apiKey: 'k', keywords: ['a', 'b'], now, fetchImpl: fetchImpl as unknown as typeof fetch })

    const lookups = calls(fetchImpl, '/videos')
    expect(lookups).toHaveLength(1)
    expect(lookups[0].searchParams.get('id')!.split(',').sort()).toEqual(['x', 'y', 'z'])
    expect(lookups[0].searchParams.get('part')).toBe('snippet,statistics')
  })

  it('sorts by view count, limits the result, and maps fields', async () => {
    const fetchImpl = fakeYouTube({ q: ['a', 'b', 'c'] }, [video('a', '10'), video('b', '300'), video('c', '20')])
    const result = await fetchTrends({ apiKey: 'k', keywords: ['q'], now, limit: 2, fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(result).toEqual([
      { videoId: 'b', title: 'Title b', channelTitle: 'Channel b', viewCount: 300, thumbnailUrl: 'https://i.ytimg.com/vi/b/mqdefault.jpg' },
      { videoId: 'c', title: 'Title c', channelTitle: 'Channel c', viewCount: 20, thumbnailUrl: 'https://i.ytimg.com/vi/c/mqdefault.jpg' },
    ])
  })

  it('skips the videos call when search finds nothing', async () => {
    const fetchImpl = fakeYouTube({}, [])
    const result = await fetchTrends({ apiKey: 'k', keywords: ['nothing'], now, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result).toEqual([])
    expect(calls(fetchImpl, '/videos')).toHaveLength(0)
  })

  it('throws YouTubeApiError with the HTTP status on failure', async () => {
    const fetchImpl = vi.fn(async () => json({ error: { message: 'quotaExceeded' } }, 403))
    await expect(
      fetchTrends({ apiKey: 'k', keywords: ['q'], now, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ name: 'YouTubeApiError', status: 403 })
    await expect(
      fetchTrends({ apiKey: 'k', keywords: ['q'], now, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(YouTubeApiError)
  })
})
