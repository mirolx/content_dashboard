'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { authErrorKey, type AuthErrorKey } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/server'
import { syncLocaleCookie } from '@/i18n/sync'

export type AuthState = { error?: AuthErrorKey; notice?: 'checkEmail' } | undefined

const credentials = z.object({
  mode: z.enum(['login', 'signup']),
  email: z.email(),
  password: z.string().min(6).max(72),
})

export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'invalidInput' }
  const { mode, email, password } = parsed.data

  const supabase = await createClient()

  if (mode === 'login') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: authErrorKey(error.code) }
    await syncLocaleCookie(data.user)
    redirect('/youtube')
  }

  const origin = (await headers()).get('origin') ?? ''
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { locale: await getLocale() },
    },
  })
  if (error) return { error: authErrorKey(error.code) }
  // 메일 인증이 켜져 있으면 세션 없이 돌아온다.
  if (!data.session) return { notice: 'checkEmail' }
  redirect('/youtube')
}
