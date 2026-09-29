import { describe, expect, it, vi } from 'vitest'
import { asFetch, callsTo, fakeYouTube, json, rawChannel } from './fakeYouTube'
import { lookupChannel } from './lookupChannel'

const ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'

describe('lookupChannel', () => {
  const yt = () => fakeYouTube({ channels: [rawChannel(ID, 'Yapper', 'The Yapper')] })

  it('finds a channel by handle', async () => {
    const fetchImpl = yt()
    const info = await lookupChannel({ apiKey: 'k', query: { handle: 'yapper' }, fetchImpl: asFetch(fetchImpl) })
    expect(info).toEqual({
      channelId: ID,
      handle: 'Yapper',
      title: 'The Yapper',
      thumbnailUrl: `https://yt3.ggpht.com/${ID}`,
      uploadsPlaylistId: 'UU_x5XG1OV2P6uZZ5FSM9Ttw',
    })
    const [call] = callsTo(fetchImpl, '/channels')
    expect(call.searchParams.get('forHandle')).toBe('@yapper')
    expect(call.searchParams.get('part')).toBe('snippet,contentDetails')
  })

  it('finds a channel by id', async () => {
    const fetchImpl = yt()
    const info = await lookupChannel({ apiKey: 'k', query: { channelId: ID }, fetchImpl: asFetch(fetchImpl) })
    expect(info?.channelId).toBe(ID)
    expect(callsTo(fetchImpl, '/channels')[0].searchParams.get('id')).toBe(ID)
  })

  it('returns null when nothing matches', async () => {
    const info = await lookupChannel({ apiKey: 'k', query: { handle: 'nobody' }, fetchImpl: asFetch(yt()) })
    expect(info).toBeNull()
  })

  it('propagates API errors', async () => {
    const fetchImpl = vi.fn(async () => json({}, 500))
    await expect(
      lookupChannel({ apiKey: 'k', query: { handle: 'x' }, fetchImpl: asFetch(fetchImpl) }),
    ).rejects.toMatchObject({ name: 'YouTubeApiError', status: 500 })
  })
})
