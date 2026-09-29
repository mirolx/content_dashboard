export type ChannelQuery = { handle: string } | { channelId: string }

const CHANNEL_ID = /^UC[\w-]{22}$/
const HANDLE = /^[\p{L}\p{N}_.-]{3,30}$/u

/** "@handle", 채널 URL, "UC…" 채널 ID를 받아 조회 조건으로 바꾼다. 알아볼 수 없으면 null. */
export function parseChannelInput(input: string): ChannelQuery | null {
  const value = input.trim()
  if (CHANNEL_ID.test(value)) return { channelId: value }
  if (value.startsWith('@')) {
    const handle = value.slice(1)
    return HANDLE.test(handle) ? { handle } : null
  }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return null

  const [first, second] = url.pathname.split('/').filter(Boolean)
  if (first?.startsWith('@')) {
    let handle: string
    try {
      handle = decodeURIComponent(first.slice(1))
    } catch {
      return null
    }
    return HANDLE.test(handle) ? { handle } : null
  }
  if (first === 'channel' && second && CHANNEL_ID.test(second)) return { channelId: second }
  return null
}
