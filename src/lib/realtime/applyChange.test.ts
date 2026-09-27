import { describe, expect, it } from 'vitest'
import { applyChange, rollbackChange, toChangeEvent, type ChangeEvent } from './applyChange'

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

describe('rollbackChange', () => {
  it('removes an optimistically inserted row', () => {
    const event: ChangeEvent<Item> = { type: 'INSERT', row: { id: 'c', n: 3 } }
    const applied = applyChange(list, event)
    expect(rollbackChange(applied, event, undefined)).toEqual(list)
  })

  it('returns the same array when rolling back an insert that is already gone', () => {
    const event: ChangeEvent<Item> = { type: 'INSERT', row: { id: 'c', n: 3 } }
    expect(rollbackChange(list, event, undefined)).toBe(list)
  })

  it('re-inserts a deleted row when it is not back in the list', () => {
    const before = { id: 'b', n: 2 }
    const applied = applyChange(list, { type: 'DELETE', id: 'b' })
    expect(rollbackChange(applied, { type: 'DELETE', id: 'b' }, before)).toEqual(list)
  })

  it('does not duplicate a deleted row that already came back (e.g. via realtime)', () => {
    const before = { id: 'b', n: 2 }
    const withEcho: Item[] = [{ id: 'a', n: 1 }, { id: 'b', n: 20 }]
    expect(rollbackChange(withEcho, { type: 'DELETE', id: 'b' }, before)).toBe(withEcho)
  })

  it('returns the list unchanged when deleting without a captured before', () => {
    const applied = applyChange(list, { type: 'DELETE', id: 'b' })
    expect(rollbackChange(applied, { type: 'DELETE', id: 'b' }, undefined)).toBe(applied)
  })

  it('restores only the patched fields of an update', () => {
    const before: Item = { id: 'a', n: 1 }
    const event: ChangeEvent<Item> = { type: 'UPDATE', row: { id: 'a', n: 9 } }
    const applied = applyChange(list, event)
    expect(rollbackChange(applied, event, before)).toEqual(list)
  })

  it('returns the list unchanged when the row is gone or before is missing', () => {
    const event: ChangeEvent<Item> = { type: 'UPDATE', row: { id: 'a', n: 9 } }
    expect(rollbackChange(list, event, undefined)).toBe(list)

    const withoutRow = list.filter((r) => r.id !== 'a')
    expect(rollbackChange(withoutRow, event, { id: 'a', n: 1 })).toBe(withoutRow)
  })

  it('offline scenario: two overlapping optimistic updates that both fail restore the original row', () => {
    type Task = { id: string; title: string; done: boolean }
    const original: Task = { id: 't1', title: 'Draft', done: false }
    const start: Task[] = [original]

    // A: edit title
    const eventA: ChangeEvent<Task> = { type: 'UPDATE', row: { ...original, title: 'Final draft' } }
    const beforeA = start.find((r) => r.id === 't1')
    const afterA = applyChange(start, eventA)

    // B: tick checkbox, applied on top of A's optimistic state
    const eventB: ChangeEvent<Task> = {
      type: 'UPDATE',
      row: { ...afterA[0], done: true },
    }
    const beforeB = afterA.find((r) => r.id === 't1')
    const afterB = applyChange(afterA, eventB)

    // Both writes fail, in order A then B.
    const afterRollbackA = rollbackChange(afterB, eventA, beforeA)
    const afterRollbackB = rollbackChange(afterRollbackA, eventB, beforeB)

    expect(afterRollbackB).toEqual(start)
  })

  it('preserves a remote change to a different field made between apply and failure', () => {
    type Task = { id: string; title: string; done: boolean }
    const before: Task = { id: 't1', title: 'Draft', done: false }
    const event: ChangeEvent<Task> = { type: 'UPDATE', row: { ...before, title: 'Final draft' } }
    const applied = applyChange([before], event)

    // Remote UPDATE changes `done` on another device before our write fails.
    const withRemoteChange = applyChange(applied, {
      type: 'UPDATE',
      row: { ...applied[0], done: true },
    })

    const rolledBack = rollbackChange(withRemoteChange, event, before)
    expect(rolledBack).toEqual([{ id: 't1', title: 'Draft', done: true }])
  })

  it('preserves a later edit to the same field (current value no longer matches the patch)', () => {
    const before: Item = { id: 'a', n: 1 }
    const event: ChangeEvent<Item> = { type: 'UPDATE', row: { id: 'a', n: 9 } }
    const applied = applyChange(list, event)

    // A later edit changes n again before the first write's failure is handled.
    const editedAgain = applyChange(applied, { type: 'UPDATE', row: { id: 'a', n: 42 } })

    const rolledBack = rollbackChange(editedAgain, event, before)
    expect(rolledBack).toEqual(editedAgain)
  })

  it('applies compare when the list changes', () => {
    const before: Item = { id: 'a', n: 1 }
    const event: ChangeEvent<Item> = { type: 'UPDATE', row: { id: 'a', n: 9 } }
    const applied = applyChange(list, event, byN) // [b(2), a(9)]
    expect(rollbackChange(applied, event, before, byN).map((r) => r.id)).toEqual(['a', 'b'])
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
