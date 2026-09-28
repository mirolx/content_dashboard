'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/requireUser'
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import { getTodayTrends } from '@/lib/trends/getTodayTrends'
import type { ActionResult } from '@/lib/types'

/** 오늘 저장된 트렌드를 지우고 현재 키워드로 다시 가져온다. */
export async function refetchTodayTrends(workspaceId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(workspaceId).success) return { error: 'invalid' }
  await requireUser()

  const supabase = await createClient()
  const { error } = await supabase
    .from('trend_topics')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('fetched_on', seoulDateString(new Date()))
  if (error) return { error: error.message }

  const result = await getTodayTrends(workspaceId)
  revalidatePath('/youtube')
  return result.status === 'failed' ? { error: 'fetch-failed' } : { ok: true }
}
