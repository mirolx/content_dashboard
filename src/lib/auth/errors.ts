export type AuthErrorKey =
  | 'invalidInput'
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'userExists'
  | 'weakPassword'
  | 'callback'
  | 'generic'

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  user_already_exists: 'userExists',
  email_exists: 'userExists',
  weak_password: 'weakPassword',
}

/** Supabase AuthError.code → messages의 auth.errors 키 */
export function authErrorKey(code: string | undefined): AuthErrorKey {
  return (code && BY_CODE[code]) || 'generic'
}
