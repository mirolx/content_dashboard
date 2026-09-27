import { describe, expect, it } from 'vitest'
import { seoulDateString } from './dates'

describe('seoulDateString', () => {
  it('returns the Seoul calendar date just before Seoul midnight', () => {
    // 2026-09-28 23:59:59 KST
    expect(seoulDateString(new Date('2026-09-28T14:59:59Z'))).toBe('2026-09-28')
  })

  it('rolls over to the next day at Seoul midnight', () => {
    // 2026-09-29 00:00:00 KST
    expect(seoulDateString(new Date('2026-09-28T15:00:00Z'))).toBe('2026-09-29')
  })

  it('pads month and day', () => {
    expect(seoulDateString(new Date('2026-01-04T03:00:00Z'))).toBe('2026-01-04')
  })
})
