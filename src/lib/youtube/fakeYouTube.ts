import { vi } from 'vitest'

/** 테스트 전용: YouTube Data API를 흉내 내는 fetch. 앱 코드에서 import하지 않는다. */

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export function rawVideo(
  id: string,
  {
    views = '100',
    duration = 'PT10M',
    category = '22',
    publishedAt = '2026-09-25T00:00:00Z',
    channelId = 'UCa',
  }: { views?: string; duration?: string; category?: string; publishedAt?: string; channelId?: string } = {},
) {
  return {
    id,
    snippet: {
      title: `Title ${id}`,
      channelId,
      channelTitle: `Channel ${channelId}`,
      categoryId: category,
      publishedAt,
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
    },
    statistics: { viewCount: views },
    contentDetails: { duration },
  }
}

export function rawChannel(id: string, handle: string, title: string) {
  return {
    id,
    snippet: { title, customUrl: `@${handle}`, thumbnails: { default: { url: `https://yt3.ggpht.com/${id}` } } },
    contentDetails: { relatedPlaylists: { uploads: id.replace(/^UC/, 'UU') } },
  }
}

export function fakeYouTube({
  search = {},
  videos = [],
  playlists = {},
  channels = [],
}: {
  search?: Record<string, string[]>
  videos?: ReturnType<typeof rawVideo>[]
  playlists?: Record<string, string[] | 'missing'>
  channels?: ReturnType<typeof rawChannel>[]
}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    const p = url.searchParams
    if (url.pathname.endsWith('/search')) {
      return json({ items: (search[p.get('q') ?? ''] ?? []).map((videoId) => ({ id: { videoId } })) })
    }
    if (url.pathname.endsWith('/videos')) {
      const ids = (p.get('id') ?? '').split(',')
      return json({ items: videos.filter((v) => ids.includes(v.id)) })
    }
    if (url.pathname.endsWith('/playlistItems')) {
      const list = playlists[p.get('playlistId') ?? '']
      if (!list || list === 'missing') return json({ error: { code: 404 } }, 404)
      return json({ items: list.map((videoId) => ({ contentDetails: { videoId } })) })
    }
    if (url.pathname.endsWith('/channels')) {
      const handle = p.get('forHandle')?.replace(/^@/, '').toLowerCase()
      const id = p.get('id')
      const items = channels.filter(
        (c) => (handle && c.snippet.customUrl.toLowerCase() === `@${handle}`) || (id && c.id === id),
      )
      return json(items.length > 0 ? { items } : {})
    }
    return json({}, 404)
  })
}

export type FakeYouTube = ReturnType<typeof fakeYouTube>

export function asFetch(fn: FakeYouTube | ReturnType<typeof vi.fn>) {
  return fn as unknown as typeof fetch
}

export function callsTo(fn: FakeYouTube, path: string) {
  return fn.mock.calls.map(([input]) => new URL(String(input))).filter((u) => u.pathname.endsWith(path))
}
