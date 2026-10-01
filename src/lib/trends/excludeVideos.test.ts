import { describe, expect, it } from 'vitest'
import { excludeVideos } from './excludeVideos'

const v = (videoId: string) => ({ videoId })
const ids = (r: { channel: { videoId: string }[]; keyword: { videoId: string }[] }) => [
  r.channel.map((x) => x.videoId),
  r.keyword.map((x) => x.videoId),
]

describe('excludeVideos', () => {
  it('removes excluded videos from both lists', () => {
    expect(ids(excludeVideos([v('a'), v('b')], [v('c'), v('a')], ['a']))).toEqual([['b'], ['c']])
  })

  it('returns the original lists when nothing would be left', () => {
    expect(ids(excludeVideos([v('a')], [v('b')], new Set(['a', 'b'])))).toEqual([['a'], ['b']])
  })
})
