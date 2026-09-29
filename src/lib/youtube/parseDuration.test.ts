import { describe, expect, it } from 'vitest'
import { parseDuration } from './parseDuration'

describe('parseDuration', () => {
  it.each([
    ['PT12M3S', 723],
    ['PT1H', 3600],
    ['PT45S', 45],
    ['PT3M', 180],
    ['P1DT1S', 86401],
    ['P0D', 0],
  ])('%s → %i seconds', (iso, seconds) => {
    expect(parseDuration(iso)).toBe(seconds)
  })

  it('returns 0 for unparseable input', () => {
    expect(parseDuration('')).toBe(0)
    expect(parseDuration('12:03')).toBe(0)
  })
})
