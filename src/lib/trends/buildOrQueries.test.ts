import { describe, expect, it } from 'vitest'
import { buildOrQueries } from './buildOrQueries'

const k = (keyword: string, group_name: string | null) => ({ keyword, group_name })

describe('buildOrQueries', () => {
  it('joins keywords of the same group with |', () => {
    expect(buildOrQueries([k('glow up', 'beauty'), k('mindset', 'self'), k('that girl', 'beauty')])).toEqual([
      'glow up|that girl',
      'mindset',
    ])
  })

  it('splits a group into chunks of at most 4', () => {
    const picked = ['a', 'b', 'c', 'd', 'e'].map((x) => k(x, 'g'))
    expect(buildOrQueries(picked)).toEqual(['a|b|c|d', 'e'])
  })

  it('treats null as its own group', () => {
    expect(buildOrQueries([k('x', null), k('y', null)])).toEqual(['x|y'])
  })

  it('returns [] for no keywords', () => {
    expect(buildOrQueries([])).toEqual([])
  })
})
