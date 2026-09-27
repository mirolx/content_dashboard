import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/** 서버 컴포넌트·Server Action에서 로그인을 재확인한다. 없으면 /login으로 보낸다. (데이터 보호는 RLS 담당) */
export const requireUser = cache(async (): Promise<User> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
})
