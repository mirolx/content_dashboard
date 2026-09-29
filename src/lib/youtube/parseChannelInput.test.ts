import { describe, expect, it } from 'vitest'
import { parseChannelInput } from './parseChannelInput'

const ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'

describe('parseChannelInput', () => {
  it.each([
    ['@yapper', { handle: 'yapper' }],
    ['  @yap.per_1  ', { handle: 'yap.per_1' }],
    ['youtube.com/@yapper', { handle: 'yapper' }],
    ['https://www.youtube.com/@yapper/videos', { handle: 'yapper' }],
    ['https://m.youtube.com/@yapper', { handle: 'yapper' }],
    [`https://www.youtube.com/channel/${ID}`, { channelId: ID }],
    [ID, { channelId: ID }],
  ])('parses %s', (input, expected) => {
    expect(parseChannelInput(input)).toEqual(expected)
  })

  it.each([
    [''],
    ['yapper'],
    ['@a'],
    ['https://example.com/@yapper'],
    ['https://www.youtube.com/watch?v=abc123'],
    ['https://www.youtube.com/channel/not-an-id'],
  ])('rejects %s', (input) => {
    expect(parseChannelInput(input)).toBeNull()
  })
})
