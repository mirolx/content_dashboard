'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth/requireUser'
import { createClient } from '@/lib/supabase/server'
import { parseKeywordList } from '@/lib/trends/parseKeywordList'
import type { TrendKeyword } from '@/lib/types'

export type AddKeywordsError = 'invalid' | 'limit' | 'failed'

const MAX_KEYWORDS = 100
const MAX_GROUP_LENGTH = 30

/** 붙여넣은 키워드 목록을 그룹과 함께 한 번에 저장한다. 기존 키워드와 대소문자만 다른 것은 건너뛴다. */
export async function addKeywords(
  workspaceId: string,
  groupName: string,
  text: string,
): Promise<
  | { ok: true; rows: TrendKeyword[]; added: number; skipped: number; truncated: number }
  | { error: AddKeywordsError }
> {
  if (!z.uuid().safeParse(workspaceId).success) return { error: 'invalid' }
  await requireUser()

  const parsed = parseKeywordList(text)
  if (parsed.length === 0) return { error: 'invalid' }
  const group = groupName.trim().replace(/\s+/g, ' ').slice(0, MAX_GROUP_LENGTH).trim() || null

  const supabase = await createClient()
  const { data: existingRows, error: readError } = await supabase
    .from('trend_keywords')
    .select('keyword')
    .eq('workspace_id', workspaceId)
  if (readError) return { error: 'failed' }

  const existing = new Set((existingRows ?? []).map((r) => (r.keyword as string).toLowerCase()))
  const fresh = parsed.filter((k) => !existing.has(k.toLowerCase()))
  const room = MAX_KEYWORDS - existing.size
  if (fresh.length > 0 && room <= 0) return { error: 'limit' }

  const toInsert = fresh.slice(0, Math.max(room, 0))
  const skipped = parsed.length - fresh.length
  const truncated = fresh.length - toInsert.length
  if (toInsert.length === 0) return { ok: true, rows: [], added: 0, skipped, truncated }

  const { data, error } = await supabase
    .from('trend_keywords')
    .insert(toInsert.map((keyword) => ({ workspace_id: workspaceId, keyword, group_name: group })))
    .select()
  if (error) return { error: 'failed' }
  return { ok: true, rows: (data ?? []) as TrendKeyword[], added: toInsert.length, skipped, truncated }
}
