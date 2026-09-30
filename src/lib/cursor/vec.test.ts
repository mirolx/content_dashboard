import { describe, expect, it } from 'vitest'
import { length, lerp, sub, vec } from './vec'

describe('vec', () => {
  it('lerps between two points', () => {
    expect(lerp(vec(0, 0), vec(10, 20), 0.5)).toEqual({ x: 5, y: 10 })
    expect(lerp(vec(1, 1), vec(9, 9), 1)).toEqual({ x: 9, y: 9 })
    expect(lerp(vec(1, 1), vec(9, 9), 0)).toEqual({ x: 1, y: 1 })
  })

  it('subtracts and measures length', () => {
    expect(sub(vec(5, 7), vec(2, 3))).toEqual({ x: 3, y: 4 })
    expect(length(vec(3, 4))).toBe(5)
  })

  it('defaults to the origin and does not mutate inputs', () => {
    const a = vec()
    expect(a).toEqual({ x: 0, y: 0 })
    lerp(a, vec(4, 4), 0.5)
    expect(a).toEqual({ x: 0, y: 0 })
  })
})
