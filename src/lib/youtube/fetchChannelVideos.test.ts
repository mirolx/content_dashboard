import { describe, expect, it } from 'vitest'
import { asFetch, callsTo, fakeYouTube, rawVideo } from './fakeYouTube'
import { fetchChannelVideos } from './fetchChannelVideos'

const now = new Date('2026-09-29T00:00:00Z')

describe('fetchChannelVideos', () => {
  it('returns [] without calling the API when there are no channels', async () => {
    const yt = fakeYouTube({})
    expect(await fetchChannelVideos({ apiKey: 'k', playlistIds: [], now, fetchImpl: asFetch(yt) })).toEqual([])
    expect(yt).not.toHaveBeenCalled()
  })

  it('reads 20 recent uploads per channel', async () => {
    const yt = fakeYouTube({ playlists: { UUa: ['a1'] }, videos: [rawVideo('a1')] })
    await fetchChannelVideos({ apiKey: 'k', playlistIds: ['UUa'], now, fetchImpl: asFetch(yt) })
    const [call] = callsTo(yt, '/playlistItems')
    expect(call.searchParams.get('playlistId')).toBe('UUa')
    expect(call.searchParams.get('maxResults')).toBe('20')
    expect(call.searchParams.get('part')).toBe('contentDetails')
  })

  it('keeps last-30-day videos over 180s, sorted by views, at most 2 per channel', async () => {
    const yt = fakeYouTube({
      playlists: { UUa: ['a1', 'a2', 'a3', 'aOld', 'aShort'], UUb: ['b1'] },
      videos: [
        rawVideo('a1', { views: '300', channelId: 'UCa' }),
        rawVideo('a2', { views: '200', channelId: 'UCa' }),
        rawVideo('a3', { views: '100', channelId: 'UCa' }),
        rawVideo('aOld', { views: '9999', channelId: 'UCa', publishedAt: '2026-08-20T00:00:00Z' }),
        rawVideo('aShort', { views: '8888', channelId: 'UCa', duration: 'PT2M' }),
        rawVideo('b1', { views: '150', channelId: 'UCb', category: '10' }),
      ],
    })
    const result = await fetchChannelVideos({ apiKey: 'k', playlistIds: ['UUa', 'UUb'], now, fetchImpl: asFetch(yt) })

    // 카테고리 필터 없음 (b1은 음악 카테고리지만 남는다)
    expect(result.map((v) => v.videoId)).toEqual(['a1', 'a2', 'b1'])
  })

  it('skips a deleted or private channel (404) and keeps the others', async () => {
    const yt = fakeYouTube({
      playlists: { UUgone: 'missing', UUb: ['b1'] },
      videos: [rawVideo('b1', { channelId: 'UCb' })],
    })
    const result = await fetchChannelVideos({ apiKey: 'k', playlistIds: ['UUgone', 'UUb'], now, fetchImpl: asFetch(yt) })
    expect(result.map((v) => v.videoId)).toEqual(['b1'])
  })
})
