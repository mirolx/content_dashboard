'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, type Locale } from './locale'

export async function setLocale(locale: Locale): Promise<ActionResult> {
  if (!isLocale(locale)) return { error: 'invalid-locale' }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { error } = await supabase.auth.updateUser({ data: { locale } })
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
