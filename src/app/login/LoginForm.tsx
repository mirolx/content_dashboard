'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AuthErrorKey } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { fieldClass } from '@/components/ui/field'
import { pillClass } from '@/components/ui/pill-tabs'
import { authenticate } from './actions'

type Mode = 'login' | 'signup'

export function LoginForm({ callbackFailed }: { callbackFailed: boolean }) {
  const t = useTranslations('auth')
  const [mode, setMode] = useState<Mode>('login')
  const [state, formAction, pending] = useActionState(authenticate, undefined)
  const [oauthFailed, setOauthFailed] = useState(false)

  async function continueWithGoogle() {
    setOauthFailed(false)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setOauthFailed(true)
  }

  const errorKey: AuthErrorKey | null =
    state?.error ?? (oauthFailed ? 'generic' : callbackFailed ? 'callback' : null)

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[28px] bg-cream p-8 text-ink">
        <h1 className="mb-6 text-4xl font-extrabold leading-none tracking-tight">{t('title')}</h1>

        <div role="tablist" className="mb-6 flex gap-2">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              data-magnetic
              className={`${pillClass(mode === m, 'light')}`}
            >
              {t(m === 'login' ? 'loginTab' : 'signupTab')}
            </button>
          ))}
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="mode" value={mode} />
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('email')}
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={`${fieldClass} w-full`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('password')}
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={`${fieldClass} w-full`}
            />
          </label>

          {errorKey && (
            <p role="alert" className="rounded-xl border-l-4 border-danger bg-ink/5 px-3 py-2 text-sm font-medium text-ink">
              {t(`errors.${errorKey}`)}
            </p>
          )}
          {state?.notice === 'checkEmail' && (
            <p role="status" className="text-sm font-medium opacity-80">
              {t('checkEmail')}
            </p>
          )}

          <Button type="submit" disabled={pending} className="mt-2 w-full">
            {t(mode === 'login' ? 'submitLogin' : 'submitSignup')}
          </Button>
        </form>

        <p className="my-4 text-center text-xs uppercase tracking-widest opacity-75">{t('or')}</p>
        <Button variant="ghost" onClick={() => void continueWithGoogle()} className="w-full">
          {t('google')}
        </Button>
      </div>
    </main>
  )
}
