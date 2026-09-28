import { cache } from 'react'
import { requireUser } from '@/lib/auth/requireUser'
import { createClient } from '@/lib/supabase/server'
import type { Platform, Workspace } from '@/lib/types'

/** 현재 사용자의 해당 플랫폼 워크스페이스. RLS 덕분에 본인 것만 조회된다. */
export const getWorkspace = cache(async (platform: Platform): Promise<Workspace | null> => {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from('workspaces').select('*').eq('platform', platform).maybeSingle()
  if (error) throw new Error(`workspaces: ${error.message}`)
  return data as Workspace | null
})
