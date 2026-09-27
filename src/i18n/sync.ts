import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, localeFromUser } from './locale'

/** 로그인 직후, 계정에 저장된 언어를 이 브라우저의 쿠키로 옮긴다. */
export async function syncLocaleCookie(user: User | null): Promise<void> {
  const locale = localeFromUser(user)
  if (!locale) return
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS)
}
