import type { VideoDetail } from '@/lib/youtube/api'

export type Scorable = { title: string; tags: string[]; description: string }
export type ScoredVideo = VideoDetail & { relevance: number; matched: string[] }

const TITLE_POINTS = 2
const OTHER_POINTS = 1

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 앞뒤가 글자·숫자가 아닌 자리에서 구문이 나타나는지 (예: "glow up"은 "glowing up"에 맞지 않음) */
function containsPhrase(text: string, phrase: string) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(phrase)}($|[^\\p{L}\\p{N}])`, 'u').test(text)
}

/** 풀 키워드가 제목(2점)·태그/설명(1점)에 몇 개 들어 있는지 센다. matched는 제목 매칭이 먼저. */
export function scoreVideo(video: Scorable, pool: string[]): { relevance: number; matched: string[] } {
  const title = video.title.toLowerCase()
  const rest = [...video.tags, video.description].join('\n').toLowerCase()
  const inTitle: string[] = []
  const inRest: string[] = []
  for (const keyword of pool) {
    const phrase = keyword.trim().toLowerCase()
    if (!phrase) continue
    if (containsPhrase(title, phrase)) inTitle.push(keyword)
    else if (containsPhrase(rest, phrase)) inRest.push(keyword)
  }
  return {
    relevance: inTitle.length * TITLE_POINTS + inRest.length * OTHER_POINTS,
    matched: [...inTitle, ...inRest],
  }
}

export function scoreAll(videos: VideoDetail[], pool: string[]): ScoredVideo[] {
  return videos.map((v) => ({ ...v, ...scoreVideo(v, pool) }))
}

export const byRelevanceThenViews = (
  a: { relevance: number; viewCount: number },
  b: { relevance: number; viewCount: number },
) => b.relevance - a.relevance || b.viewCount - a.viewCount
