import { describe, expect, it } from 'vitest'
import { positionAfter, positionBetween } from './position'

describe('positionAfter', () => {
  it('starts at 1 for an empty list', () => {
    expect(positionAfter([])).toBe(1)
  })

  it('goes one past the largest position', () => {
    expect(positionAfter([3, 1.5, 2])).toBe(4)
  })
})

describe('positionBetween', () => {
  it('returns the midpoint of two neighbours', () => {
    expect(positionBetween(1, 2)).toBe(1.5)
  })

  it('goes before the first item', () => {
    expect(positionBetween(undefined, 1)).toBe(0)
  })

  it('goes after the last item', () => {
    expect(positionBetween(4, undefined)).toBe(5)
  })

  it('returns 1 with no neighbours', () => {
    expect(positionBetween()).toBe(1)
  })
})
