'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/requireUser'
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import { getTodayTrends } from '@/lib/trends/getTodayTrends'
import type { ActionResult } from '@/lib/types'

/** 오늘 저장된 트렌드를 지우고 현재 채널·키워드로 다시 가져온다. */
export async function refetchTodayTrends(workspaceId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(workspaceId).success) return { error: 'invalid' }
  await requireUser()

  const supabase = await createClient()
  const today = seoulDateString(new Date())
  // 방금 보던 영상은 다시 가져올 때 빼서, 누를 때마다 새 영상이 나오게 한다. 읽기 실패는 무시.
  const { data: shown } = await supabase
    .from('trend_topics')
    .select('video_id')
    .eq('workspace_id', workspaceId)
    .eq('fetched_on', today)
  const exclude = (shown ?? []).map((r) => r.video_id as string)

  const { error } = await supabase
    .from('trend_topics')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('fetched_on', today)
  if (error) return { error: error.message }

  const result = await getTodayTrends(workspaceId, { exclude })
  revalidatePath('/youtube')
  return result.status === 'failed' ? { error: 'fetch-failed' } : { ok: true }
}
