export const LOCALES = ['ko', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_COOKIE = 'NEXT_LOCALE'
export const LOCALE_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** 쿠키가 유효하면 쿠키, 아니면 Accept-Language에 한국어가 있으면 ko, 그 외 en */
export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie
  return /\bko\b/i.test(acceptLanguage ?? '') ? 'ko' : 'en'
}

export function localeFromUser(
  user: { user_metadata?: Record<string, unknown> } | null,
): Locale | null {
  const locale = user?.user_metadata?.locale
  return isLocale(locale) ? locale : null
}
