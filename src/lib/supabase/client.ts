import { createBrowserClient } from '@supabase/ssr'

/** 브라우저용 Supabase 클라이언트. @supabase/ssr가 브라우저에서는 싱글턴으로 재사용한다. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
