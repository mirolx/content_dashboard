import { isPlatform, type Platform } from '@/lib/types'

/** "/youtube/settings" → "youtube". 워크스페이스 밖이면 null. */
export function platformFromPath(pathname: string): Platform | null {
  const first = pathname.split('/')[1] ?? ''
  return isPlatform(first) ? first : null
}
