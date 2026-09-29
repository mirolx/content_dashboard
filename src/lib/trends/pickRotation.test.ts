import { describe, expect, it } from 'vitest'
import { pickRotation, type RotationKeyword } from './pickRotation'

let seq = 0
const k = (keyword: string, group_name: string | null, last_searched_on: string | null = null): RotationKeyword => ({
  id: keyword,
  keyword,
  group_name,
  last_searched_on,
  created_at: `2026-09-01T00:00:${String(seq++).padStart(2, '0')}Z`,
})
const names = (list: RotationKeyword[]) => list.map((x) => x.keyword)

describe('pickRotation', () => {
  it('takes one per group in turn, groups in alphabetical order with ungrouped last', () => {
    const list = [k('z1', null), k('b1', 'b'), k('a1', 'a'), k('a2', 'a'), k('b2', 'b')]
    expect(names(pickRotation(list, 4))).toEqual(['a1', 'b1', 'z1', 'a2'])
  })

  it('prefers never-searched, then the oldest search date', () => {
    const list = [k('recent', 'a', '2026-09-28'), k('old', 'a', '2026-09-01'), k('never', 'a', null)]
    expect(names(pickRotation(list, 2))).toEqual(['never', 'old'])
  })

  it('breaks ties by registration order', () => {
    const list = [k('first', 'a'), k('second', 'a')]
    expect(names(pickRotation(list, 1))).toEqual(['first'])
  })

  it('returns everything when there are fewer than n', () => {
    expect(names(pickRotation([k('only', null)], 10))).toEqual(['only'])
    expect(pickRotation([], 10)).toEqual([])
  })

  it('defaults to 10', () => {
    const list = Array.from({ length: 15 }, (_, i) => k(`w${i}`, 'g'))
    expect(pickRotation(list)).toHaveLength(10)
  })
})
