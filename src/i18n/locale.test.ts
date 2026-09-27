import { describe, expect, it } from 'vitest'
import { isLocale, localeFromUser, resolveLocale } from './locale'

describe('isLocale', () => {
  it('accepts ko and en only', () => {
    expect(isLocale('ko')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('ja')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

describe('resolveLocale', () => {
  it('prefers a valid cookie', () => {
    expect(resolveLocale('en', 'ko-KR,ko;q=0.9')).toBe('en')
  })

  it('ignores an invalid cookie and falls back to Accept-Language', () => {
    expect(resolveLocale('fr', 'ko-KR,ko;q=0.9')).toBe('ko')
  })

  it('picks ko when Korean appears anywhere in Accept-Language', () => {
    expect(resolveLocale(undefined, 'en-US,en;q=0.9,ko;q=0.8')).toBe('ko')
  })

  it('defaults to en otherwise', () => {
    expect(resolveLocale(undefined, 'en-US,en;q=0.9')).toBe('en')
    expect(resolveLocale(undefined, null)).toBe('en')
  })
})

describe('localeFromUser', () => {
  it('reads a valid locale from user metadata', () => {
    expect(localeFromUser({ user_metadata: { locale: 'ko' } })).toBe('ko')
  })

  it('returns null for missing or invalid metadata', () => {
    expect(localeFromUser(null)).toBeNull()
    expect(localeFromUser({ user_metadata: {} })).toBeNull()
    expect(localeFromUser({ user_metadata: { locale: 'de' } })).toBeNull()
  })
})
