import { describe, expect, it } from 'vitest'
import { normalizeTag, optionalUrlSchema, textSchema } from './validation'

describe('textSchema', () => {
  it('trims and requires at least one character', () => {
    expect(textSchema.parse('  hi  ')).toBe('hi')
    expect(textSchema.safeParse('   ').success).toBe(false)
  })
})

describe('optionalUrlSchema', () => {
  it('turns an empty string into null', () => {
    expect(optionalUrlSchema.parse('  ')).toBeNull()
  })

  it('accepts http and https URLs', () => {
    expect(optionalUrlSchema.parse('https://example.com/a')).toBe('https://example.com/a')
    expect(optionalUrlSchema.parse('http://example.com')).toBe('http://example.com')
  })

  it('rejects other schemes and non-URLs', () => {
    expect(optionalUrlSchema.safeParse('javascript:alert(1)').success).toBe(false)
    expect(optionalUrlSchema.safeParse('not a url').success).toBe(false)
  })
})

describe('normalizeTag', () => {
  it('strips leading # and whitespace', () => {
    expect(normalizeTag('  #storytime ')).toBe('storytime')
    expect(normalizeTag('##grwm')).toBe('grwm')
    expect(normalizeTag('day in my life')).toBe('dayinmylife')
  })

  it('returns an empty string for blank input', () => {
    expect(normalizeTag(' # ')).toBe('')
  })
})
