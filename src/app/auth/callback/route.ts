import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncLocaleCookie } from '@/i18n/sync'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await syncLocaleCookie(data.user)
      return NextResponse.redirect(`${origin}/youtube`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`)
}
