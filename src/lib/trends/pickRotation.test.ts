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
  it('picks the groups whose stalest keyword is oldest, never-searched first', () => {
    const list = [k('a1', 'a', '2026-09-20'), k('b1', 'b', null), k('c1', 'c', '2026-09-10'), k('d1', 'd', '2026-09-25')]
    expect(names(pickRotation(list, { groups: 2, perGroup: 4 }))).toEqual(['b1', 'c1'])
  })

  it('takes up to perGroup stalest keywords from each chosen group', () => {
    const list = [k('a1', 'a', '2026-09-28'), k('a2', 'a', null), k('a3', 'a', '2026-09-01'), k('a4', 'a', '2026-09-02')]
    expect(names(pickRotation(list, { groups: 1, perGroup: 3 }))).toEqual(['a2', 'a3', 'a4'])
  })

  it('breaks group ties alphabetically with ungrouped last', () => {
    const list = [k('z', null), k('b', 'b'), k('a', 'a')]
    expect(names(pickRotation(list, { groups: 3, perGroup: 1 }))).toEqual(['a', 'b', 'z'])
  })

  it('returns everything available when there are fewer groups/keywords', () => {
    expect(names(pickRotation([k('only', null)]))).toEqual(['only'])
    expect(pickRotation([])).toEqual([])
  })

  it('defaults to 4 groups × 4 keywords', () => {
    const list = ['g1', 'g2', 'g3', 'g4', 'g5'].flatMap((g) => Array.from({ length: 5 }, (_, i) => k(`${g}-${i}`, g)))
    const picked = pickRotation(list)
    expect(picked).toHaveLength(16)
    expect(new Set(picked.map((x) => x.group_name)).size).toBe(4)
  })
})
