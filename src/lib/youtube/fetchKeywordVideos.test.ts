import { describe, expect, it } from 'vitest'
import { asFetch, callsTo, fakeYouTube, rawVideo } from './fakeYouTube'
import { fetchKeywordVideos } from './fetchKeywordVideos'

const now = new Date('2026-09-29T00:00:00Z')

describe('fetchKeywordVideos', () => {
  it('returns [] without calling the API when there are no keywords', async () => {
    const yt = fakeYouTube({})
    expect(await fetchKeywordVideos({ apiKey: 'k', keywords: [], now, fetchImpl: asFetch(yt) })).toEqual([])
    expect(yt).not.toHaveBeenCalled()
  })

  it('searches each keyword by relevance with the niche parameters', async () => {
    const yt = fakeYouTube({ search: { storytime: ['a'], yapping: ['b'] }, videos: [rawVideo('a'), rawVideo('b')] })
    await fetchKeywordVideos({ apiKey: 'k', keywords: ['storytime', 'yapping'], now, fetchImpl: asFetch(yt) })

    const searches = callsTo(yt, '/search')
    expect(searches.map((u) => u.searchParams.get('q'))).toEqual(['storytime', 'yapping'])
    for (const u of searches) {
      const p = u.searchParams
      expect(p.get('type')).toBe('video')
      expect(p.get('order')).toBe('relevance')
      expect(p.get('maxResults')).toBe('25')
      expect(p.get('relevanceLanguage')).toBe('en')
      expect(p.get('regionCode')).toBe('US')
      expect(p.get('publishedAfter')).toBe('2026-09-22T00:00:00.000Z')
    }
  })

  it('dedupes ids, drops Shorts (<= 180s) and off-niche categories, and sorts by views', async () => {
    const yt = fakeYouTube({
      search: { a: ['long', 'short', 'music'], b: ['long', 'grwm', 'edge'] },
      videos: [
        rawVideo('long', { views: '10', duration: 'PT20M', category: '22' }),
        rawVideo('short', { views: '999', duration: 'PT59S', category: '22' }),
        rawVideo('music', { views: '500', duration: 'PT4M', category: '10' }),
        rawVideo('grwm', { views: '50', duration: 'PT15M', category: '26' }),
        rawVideo('edge', { views: '70', duration: 'PT3M', category: '24' }),
      ],
    })
    const result = await fetchKeywordVideos({ apiKey: 'k', keywords: ['a', 'b'], now, fetchImpl: asFetch(yt) })

    expect(result.map((v) => v.videoId)).toEqual(['grwm', 'long'])
    expect(callsTo(yt, '/videos')).toHaveLength(1)
  })
})
