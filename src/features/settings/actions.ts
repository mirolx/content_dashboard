'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

const renameInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(50),
})

export async function renameWorkspace(id: string, name: string): Promise<ActionResult> {
  const parsed = renameInput.safeParse({ id, name })
  if (!parsed.success) return { error: 'invalid' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('workspaces')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true }
}
