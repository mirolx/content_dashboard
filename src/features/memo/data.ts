import { createClient } from '@/lib/supabase/client'

export function saveMemo(workspaceId: string, memo: string) {
  return createClient().from('workspaces').update({ memo }).eq('id', workspaceId)
}
