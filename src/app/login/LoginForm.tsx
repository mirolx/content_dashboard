'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AuthErrorKey } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
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
    <main className="mx-auto mt-24 flex max-w-sm flex-col gap-4 px-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <div role="tablist" className="flex gap-2">
        {(['login', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1 text-sm ${
              mode === m ? 'bg-gray-900 text-white' : 'border border-gray-300'
            }`}
          >
            {t(m === 'login' ? 'loginTab' : 'signupTab')}
          </button>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="mode" value={mode} />
        <label className="flex flex-col gap-1 text-sm">
          {t('email')}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('password')}
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>

        {errorKey && (
          <p role="alert" className="text-sm text-red-600">
            {t(`errors.${errorKey}`)}
          </p>
        )}
        {state?.notice === 'checkEmail' && (
          <p role="status" className="text-sm text-green-700">
            {t('checkEmail')}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {t(mode === 'login' ? 'submitLogin' : 'submitSignup')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">{t('or')}</p>
      <button
        type="button"
        onClick={() => void continueWithGoogle()}
        className="rounded border border-gray-300 px-3 py-2"
      >
        {t('google')}
      </button>
    </main>
  )
}
