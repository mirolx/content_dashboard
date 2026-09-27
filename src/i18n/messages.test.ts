import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import ko from '../../messages/ko.json'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

describe('messages', () => {
  it('ko and en define exactly the same keys', () => {
    expect(keys(ko).sort()).toEqual(keys(en).sort())
  })

  it('has no empty strings', () => {
    const empty = (obj: unknown): boolean =>
      typeof obj === 'string' ? obj.trim() === '' : Object.values(obj as object).some(empty)
    expect(empty(ko)).toBe(false)
    expect(empty(en)).toBe(false)
  })
})
