import { describe, expect, it } from 'vitest'
import { authErrorKey } from './errors'

describe('authErrorKey', () => {
  it('maps known Supabase error codes', () => {
    expect(authErrorKey('invalid_credentials')).toBe('invalidCredentials')
    expect(authErrorKey('email_not_confirmed')).toBe('emailNotConfirmed')
    expect(authErrorKey('user_already_exists')).toBe('userExists')
    expect(authErrorKey('email_exists')).toBe('userExists')
    expect(authErrorKey('weak_password')).toBe('weakPassword')
  })

  it('falls back to generic', () => {
    expect(authErrorKey('over_request_rate_limit')).toBe('generic')
    expect(authErrorKey(undefined)).toBe('generic')
  })
})
