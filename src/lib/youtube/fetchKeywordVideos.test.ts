import { describe, expect, it } from 'vitest'
import { asFetch, callsTo, fakeYouTube, rawVideo } from './fakeYouTube'
import { fetchKeywordVideos } from './fetchKeywordVideos'

const now = new Date('2026-09-29T00:00:00Z')

describe('fetchKeywordVideos', () => {
  it('returns [] without calling the API when there are no queries', async () => {
    const yt = fakeYouTube({})
    expect(await fetchKeywordVideos({ apiKey: 'k', queries: [], pool: ['x'], now, fetchImpl: asFetch(yt) })).toEqual([])
    expect(yt).not.toHaveBeenCalled()
  })

  it('runs one search per OR query with 50 results by relevance', async () => {
    const yt = fakeYouTube({
      search: { 'glow up|that girl': ['a'], mindset: ['b'] },
      videos: [rawVideo('a', { title: 'glow up' }), rawVideo('b', { title: 'mindset' })],
    })
    await fetchKeywordVideos({
      apiKey: 'k',
      queries: ['glow up|that girl', 'mindset'],
      pool: ['glow up', 'mindset'],
      now,
      fetchImpl: asFetch(yt),
    })

    const searches = callsTo(yt, '/search')
    expect(searches.map((u) => u.searchParams.get('q'))).toEqual(['glow up|that girl', 'mindset'])
    for (const u of searches) {
      const p = u.searchParams
      expect(p.get('type')).toBe('video')
      expect(p.get('order')).toBe('relevance')
      expect(p.get('maxResults')).toBe('50')
      expect(p.get('relevanceLanguage')).toBe('en')
      expect(p.get('regionCode')).toBe('US')
      expect(p.get('publishedAfter')).toBe('2026-09-22T00:00:00.000Z')
    }
  })

  it('drops Shorts, off-niche categories and zero-relevance videos; sorts by relevance then views', async () => {
    const pool = ['glow up', 'that girl', 'mindset']
    const yt = fakeYouTube({
      search: { q: ['two', 'oneBig', 'oneSmall', 'none', 'short', 'music'] },
      videos: [
        rawVideo('two', { views: '5', title: 'glow up with that girl' }),
        rawVideo('oneBig', { views: '900', title: 'my mindset shift' }),
        rawVideo('oneSmall', { views: '10', title: 'weekly vlog', tags: ['mindset'] }),
        rawVideo('none', { views: '99999', title: 'random stuff' }),
        rawVideo('short', { views: '999', title: 'glow up', duration: 'PT59S' }),
        rawVideo('music', { views: '999', title: 'glow up', category: '10' }),
      ],
    })
    const result = await fetchKeywordVideos({ apiKey: 'k', queries: ['q'], pool, now, fetchImpl: asFetch(yt) })

    expect(result.map((v) => [v.videoId, v.relevance])).toEqual([
      ['two', 4],
      ['oneBig', 2],
      ['oneSmall', 1],
    ])
    expect(result[0].matched).toEqual(['glow up', 'that girl'])
  })
})
