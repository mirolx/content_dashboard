import { describe, expect, it } from 'vitest'
import { platformFromPath } from './platform'

describe('platformFromPath', () => {
  it('reads the first path segment', () => {
    expect(platformFromPath('/youtube')).toBe('youtube')
    expect(platformFromPath('/instagram/settings')).toBe('instagram')
  })

  it('returns null outside a workspace', () => {
    expect(platformFromPath('/login')).toBeNull()
    expect(platformFromPath('/')).toBeNull()
    expect(platformFromPath('')).toBeNull()
  })
})
