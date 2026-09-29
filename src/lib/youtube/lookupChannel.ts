import { getJson, YOUTUBE_API } from './api'
import type { ChannelQuery } from './parseChannelInput'

export type ChannelInfo = {
  channelId: string
  handle: string | null
  title: string
  thumbnailUrl: string
  uploadsPlaylistId: string
}

type ChannelsResponse = {
  items?: {
    id: string
    snippet: { title: string; customUrl?: string; thumbnails: Record<string, { url: string } | undefined> }
    contentDetails: { relatedPlaylists: { uploads: string } }
  }[]
}

/** 핸들이나 채널 ID로 채널을 찾는다. 없으면 null. 호출당 1 unit. */
export async function lookupChannel({
  apiKey,
  query,
  fetchImpl = fetch,
}: {
  apiKey: string
  query: ChannelQuery
  fetchImpl?: typeof fetch
}): Promise<ChannelInfo | null> {
  const params = new URLSearchParams({ part: 'snippet,contentDetails', key: apiKey })
  if ('handle' in query) params.set('forHandle', `@${query.handle}`)
  else params.set('id', query.channelId)

  const data = await getJson<ChannelsResponse>(fetchImpl, `${YOUTUBE_API}/channels?${params}`)
  const channel = data.items?.[0]
  if (!channel) return null
  return {
    channelId: channel.id,
    handle: channel.snippet.customUrl?.replace(/^@/, '') ?? null,
    title: channel.snippet.title,
    thumbnailUrl: channel.snippet.thumbnails.default?.url ?? channel.snippet.thumbnails.medium?.url ?? '',
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  }
}
