import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './id'

const V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a v4 UUID', () => {
    expect(newId()).toMatch(V4_REGEX)
  })

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()))
    expect(ids.size).toBe(50)
  })

  it('falls back to a manual v4 UUID when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    })

    expect(typeof (globalThis.crypto as { randomUUID?: unknown }).randomUUID).not.toBe('function')
    expect(newId()).toMatch(V4_REGEX)
  })
})
