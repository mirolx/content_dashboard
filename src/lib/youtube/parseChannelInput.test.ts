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
    ['@한글채널', { handle: '한글채널' }],
    ['https://www.youtube.com/@%ED%95%9C%EA%B8%80%EC%B1%84%EB%84%90', { handle: '한글채널' }],
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
    ['youtube.com/@%E0%A4%A'],
    ['https://youtube.com.evil.com/@yapper'],
    ['https://evilyoutube.com/@yapper'],
    ['https://youtube.com@evil.com/@yapper'],
  ])('rejects %s', (input) => {
    expect(parseChannelInput(input)).toBeNull()
  })
})
