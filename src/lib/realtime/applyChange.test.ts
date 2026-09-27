import { describe, expect, it } from 'vitest'
import { applyChange, inverseOf, toChangeEvent, type ChangeEvent } from './applyChange'

type Item = { id: string; n: number }
const byN = (a: Item, b: Item) => a.n - b.n
const list: Item[] = [
  { id: 'a', n: 1 },
  { id: 'b', n: 2 },
]

describe('applyChange', () => {
  it('appends an inserted row', () => {
    expect(applyChange(list, { type: 'INSERT', row: { id: 'c', n: 3 } })).toEqual([
      ...list,
      { id: 'c', n: 3 },
    ])
  })

  it('treats an INSERT for an existing id as a replace (realtime echo of an optimistic insert)', () => {
    const next = applyChange(list, { type: 'INSERT', row: { id: 'a', n: 1 } })
    expect(next).toHaveLength(2)
  })

  it('replaces an updated row and re-sorts with compare', () => {
    const next = applyChange(list, { type: 'UPDATE', row: { id: 'a', n: 5 } }, byN)
    expect(next.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('upserts an UPDATE for an unknown id', () => {
    expect(applyChange(list, { type: 'UPDATE', row: { id: 'z', n: 0 } }, byN)[0].id).toBe('z')
  })

  it('removes a deleted row', () => {
    expect(applyChange(list, { type: 'DELETE', id: 'a' })).toEqual([{ id: 'b', n: 2 }])
  })

  it('returns the same array for a DELETE of an unknown id', () => {
    expect(applyChange(list, { type: 'DELETE', id: 'other-workspace-row' })).toBe(list)
  })
})

describe('inverseOf', () => {
  it('undoes an insert with a delete', () => {
    expect(inverseOf(list, { type: 'INSERT', row: { id: 'c', n: 3 } })).toEqual({
      type: 'DELETE',
      id: 'c',
    })
  })

  it('undoes an update by restoring the previous row', () => {
    expect(inverseOf(list, { type: 'UPDATE', row: { id: 'a', n: 9 } })).toEqual({
      type: 'UPDATE',
      row: { id: 'a', n: 1 },
    })
  })

  it('undoes a delete by re-inserting the previous row', () => {
    expect(inverseOf(list, { type: 'DELETE', id: 'b' })).toEqual({
      type: 'INSERT',
      row: { id: 'b', n: 2 },
    })
  })

  it('returns null when deleting something that is not there', () => {
    expect(inverseOf(list, { type: 'DELETE', id: 'zz' })).toBeNull()
  })

  it.each<ChangeEvent<Item>>([
    { type: 'INSERT', row: { id: 'c', n: 0 } },
    { type: 'UPDATE', row: { id: 'b', n: -1 } },
    { type: 'DELETE', id: 'a' },
  ])('round-trips %o back to the original list', (event) => {
    const applied = applyChange(list, event, byN)
    const inverse = inverseOf(list, event)!
    expect(applyChange(applied, inverse, byN)).toEqual(list)
  })
})

describe('toChangeEvent', () => {
  it('maps INSERT and UPDATE payloads to their new row', () => {
    expect(toChangeEvent({ eventType: 'INSERT', new: { id: 'a' }, old: {} })).toEqual({
      type: 'INSERT',
      row: { id: 'a' },
    })
    expect(toChangeEvent({ eventType: 'UPDATE', new: { id: 'a' }, old: { id: 'a' } })).toEqual({
      type: 'UPDATE',
      row: { id: 'a' },
    })
  })

  it('maps DELETE payloads to the old id', () => {
    expect(toChangeEvent({ eventType: 'DELETE', new: {}, old: { id: 'a' } })).toEqual({
      type: 'DELETE',
      id: 'a',
    })
  })

  it('ignores a DELETE without an id', () => {
    expect(toChangeEvent({ eventType: 'DELETE', new: {}, old: {} })).toBeNull()
  })
})
