'use server'

import { z } from 'zod'
import { requireUser } from '@/lib/auth/requireUser'
import { createClient } from '@/lib/supabase/server'
import type { BenchmarkChannel } from '@/lib/types'
import { lookupChannel, type ChannelInfo } from '@/lib/youtube/lookupChannel'
import { parseChannelInput } from '@/lib/youtube/parseChannelInput'

export type AddChannelError = 'invalid' | 'limit' | 'notFound' | 'duplicate' | 'failed'

const MAX_CHANNELS = 10

/** 입력(@handle·URL·채널 ID)으로 YouTube 채널을 찾아 벤치마킹 채널로 저장한다. API 키 때문에 서버에서 처리한다. */
export async function addBenchmarkChannel(
  workspaceId: string,
  input: string,
): Promise<{ ok: true; row: BenchmarkChannel } | { error: AddChannelError }> {
  if (!z.uuid().safeParse(workspaceId).success) return { error: 'invalid' }
  await requireUser()

  const query = parseChannelInput(input)
  if (!query) return { error: 'invalid' }

  const supabase = await createClient()
  const { count, error: countError } = await supabase
    .from('benchmark_channels')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (countError) return { error: 'failed' }
  if ((count ?? 0) >= MAX_CHANNELS) return { error: 'limit' }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { error: 'failed' }

  let channel: ChannelInfo | null
  try {
    channel = await lookupChannel({ apiKey, query })
  } catch (err) {
    console.error('[channels] lookup failed:', err)
    return { error: 'failed' }
  }
  if (!channel) return { error: 'notFound' }

  const { data, error } = await supabase
    .from('benchmark_channels')
    .insert({
      workspace_id: workspaceId,
      channel_id: channel.channelId,
      handle: channel.handle,
      title: channel.title,
      thumbnail_url: channel.thumbnailUrl,
      uploads_playlist_id: channel.uploadsPlaylistId,
    })
    .select()
    .single()
  if (error) return { error: error.code === '23505' ? 'duplicate' : 'failed' }
  return { ok: true, row: data as BenchmarkChannel }
}
