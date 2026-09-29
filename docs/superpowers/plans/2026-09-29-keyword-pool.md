# 키워드 풀 · 로테이션 · 관련도 순위 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키워드를 그룹별 풀(최대 100개)로 관리하고, 매일 10개를 로테이션해 같은 그룹끼리 OR로 묶어 검색하며, 풀 전체 키워드 매칭 점수로 트렌드 순위를 매긴다.

**Architecture:** 순수 함수(`parseKeywordList`, `pickRotation`, `buildOrQueries`, `scoreVideo`)를 먼저 TDD로 만든다. YouTube 레이어는 영상 태그·설명을 받아 점수를 매기고 관련도 → 조회수 순으로 정렬한다. `getTodayTrends`가 로테이션과 OR 검색을 조립하고 점수·매칭 키워드를 저장한 뒤 `last_searched_on`을 갱신한다. 키워드 일괄 추가는 Server Action.

**Tech Stack:** Next.js 16, TypeScript, Supabase, next-intl 4, zod 4, Vitest 5, YouTube Data API v3.

**Spec:** `docs/superpowers/specs/2026-09-29-keyword-pool-design.md`

## Global Constraints

- 워크스페이스당 키워드 최대 **100개**. 키워드 1~60자, 앞뒤 공백 제거·연속 공백 하나로, 대소문자만 다른 중복 금지. 그룹 이름 최대 30자, 비면 null("기타"로 표시).
- 로테이션: 하루 **10개**, 그룹마다 `last_searched_on` 오래된 것(null 우선)부터 라운드 로빈, 그룹 순서는 가나다순·null 마지막. 저장 성공 후에만 `last_searched_on` = 오늘(서울).
- OR 묶음: 같은 그룹 키워드 최대 **4개**를 `|`로 연결, 묶음마다 `search.list` 1회, **`maxResults=50`**, 나머지 파라미터 기존과 동일(`type=video`, `order=relevance`, `relevanceLanguage=en`, `regionCode=US`, 최근 7일).
- 점수: 기준은 **풀 전체**. 제목 매칭 키워드당 **2점**, 제목엔 없고 태그·설명 앞 500자에 있으면 **1점**. 구문 단위(앞뒤가 글자·숫자가 아님), 대소문자 무시.
- 정렬: relevance 내림차순 → 조회수 내림차순. 키워드 추천은 relevance 0 제외, 채널은 유지(정렬 후 채널당 2개).
- 저장된 오늘 트렌드·폴백 재조회도 `relevance desc, view_count desc`.
- 기존 규칙 유지: 숏츠(180초 이하) 제외, 키워드 쪽 카테고리 22/23/24/26, `requireUser()` 재확인, `YOUTUBE_API_KEY` 서버 전용, 모든 문구 `messages/{ko,en}.json`(키 구성 동일), `'use server'` 파일은 async 함수만 export.
- 에이전트는 키 값을 입력·출력하지 않는다. 커밋에서 `.claude/`, AGENTS.md 변경은 제외.

## File Map

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0003_keyword_pool.sql` | 컬럼 4개 추가 |
| `src/lib/types.ts` | `TrendKeyword.group_name/last_searched_on`, `TrendTopic.relevance/matched_keywords` |
| `src/lib/trends/parseKeywordList.ts` | 붙여넣기 → 키워드 목록 |
| `src/lib/trends/pickRotation.ts` | 오늘 쓸 키워드 |
| `src/lib/trends/buildOrQueries.ts` | OR 검색어 |
| `src/lib/trends/scoreVideo.ts` | 점수, `ScoredVideo`, `scoreAll`, `byRelevanceThenViews` |
| `src/lib/youtube/api.ts` | `VideoDetail.tags/description` |
| `src/lib/youtube/fakeYouTube.ts` | `rawVideo`에 tags/description 옵션 |
| `src/lib/youtube/fetchKeywordVideos.ts` | 검색어 목록 입력, 점수 필터·정렬 |
| `src/lib/youtube/fetchChannelVideos.ts` | 점수 정렬 |
| `src/lib/trends/pickTrends.ts` | 제네릭화 |
| `src/lib/trends/getTodayTrends.ts` | 로테이션·OR·점수 저장·날짜 갱신 |
| `src/features/trends/TrendsWidget.tsx` | 매칭 키워드 태그 |
| `src/features/trends/keywordActions.ts` | `addKeywords` |
| `src/features/trends/KeywordSettings.tsx` | 그룹 폼, 그룹별 목록 |

---

### Task 1: 마이그레이션 · 타입 · 메시지

**Files:**
- Create: `supabase/migrations/0003_keyword_pool.sql`
- Modify: `src/lib/types.ts`, `messages/ko.json`, `messages/en.json`

**Interfaces:**
- Produces: `TrendKeyword = WorkspaceRow & { keyword: string; group_name: string | null; last_searched_on: string | null }`, `TrendTopic`에 `relevance: number; matched_keywords: string[]`
- Produces 메시지 키(settings): `keywordsHelp`(변경), `keywordGroupLabel`, `keywordsPlaceholder`, `keywordsAdded`, `keywordsTruncated`, `ungroupedKeywords`, `keywordErrors.{invalid,limit,failed}`; `keywordDuplicate` 삭제

- [ ] **Step 1: 마이그레이션**

`supabase/migrations/0003_keyword_pool.sql`:

```sql
-- 키워드 풀: 그룹·로테이션, 트렌드 관련도 점수
-- Supabase 대시보드 → SQL Editor에서 0002 다음에 한 번 실행한다.

alter table public.trend_keywords
  add column group_name text check (group_name is null or char_length(group_name) between 1 and 30),
  add column last_searched_on date;

alter table public.trend_topics
  add column relevance integer not null default 0,
  add column matched_keywords text[] not null default '{}';
```

- [ ] **Step 2: 타입**

`src/lib/types.ts`에서 `TrendKeyword`를 교체:

```ts
export type TrendKeyword = WorkspaceRow & {
  keyword: string
  group_name: string | null
  last_searched_on: string | null
}
```

`TrendTopic`의 `source: TrendSource` 다음 줄에 추가:

```ts
  relevance: number
  matched_keywords: string[]
```

- [ ] **Step 3: 메시지 (ko)** — `messages/ko.json`의 `"settings"`에서 `"keywordDuplicate"` 줄을 삭제하고, `"keywordsHelp"` 값을 교체한 뒤 `"keywordsEmpty"` 다음에 새 키를 추가한다.

```json
    "keywordsHelp": "매일 그룹마다 돌아가며 키워드 10개를 골라 영어권 YouTube 최근 7일 영상을 찾고, 등록한 키워드가 많이 겹치는 영상을 먼저 보여줘요. 3분 이하 영상과 니치 밖 카테고리는 제외해요. 최대 100개까지 등록할 수 있어요.",
```

```json
    "keywordsEmpty": "키워드가 없어요.",
    "keywordGroupLabel": "그룹 (선택)",
    "keywordsPlaceholder": "키워드를 쉼표나 줄바꿈으로 구분해 붙여넣으세요",
    "keywordsAdded": "{added}개 추가했어요 (중복 {skipped}개 건너뜀)",
    "keywordsTruncated": "최대 100개라서 {count}개는 추가하지 못했어요.",
    "ungroupedKeywords": "기타",
    "keywordErrors": {
      "invalid": "추가할 키워드가 없어요.",
      "limit": "키워드는 최대 100개까지 등록할 수 있어요.",
      "failed": "키워드를 추가하지 못했어요. 잠시 후 다시 시도해 주세요."
    },
```

- [ ] **Step 4: 메시지 (en)** — 같은 위치에:

```json
    "keywordsHelp": "Each day we rotate through your groups to pick 10 keywords, search recent English YouTube videos (last 7 days), and show videos that match more of your keywords first. Videos under 3 minutes and off-niche categories are skipped. Up to 100 keywords.",
```

```json
    "keywordsEmpty": "No keywords yet.",
    "keywordGroupLabel": "Group (optional)",
    "keywordsPlaceholder": "Paste keywords separated by commas or new lines",
    "keywordsAdded": "Added {added} (skipped {skipped} duplicates)",
    "keywordsTruncated": "You can have up to 100 keywords, so {count} were not added.",
    "ungroupedKeywords": "Other",
    "keywordErrors": {
      "invalid": "There are no keywords to add.",
      "limit": "You can add up to 100 keywords.",
      "failed": "Couldn't add keywords. Please try again."
    },
```

- [ ] **Step 5: 검증**

Run: `npm test -- src/i18n && npm run lint`
Expected: 통과.

Run: `npm run typecheck`
Expected: `src/features/trends/KeywordSettings.tsx`에서 `TrendKeyword` 객체 생성부(`group_name`, `last_searched_on` 누락)로 타입 오류가 날 수 있다. 이 경우 그 객체 리터럴에 `group_name: null, last_searched_on: null,`을 추가해 통과시킨다(파일은 Task 4에서 교체된다). 다른 오류는 보고서에 적는다.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_keyword_pool.sql src/lib/types.ts messages src/features/trends/KeywordSettings.tsx
git commit -m "feat: add keyword groups, rotation date, and trend relevance columns"
```

- [ ] **Step 7: ⏸ 사용자 체크포인트** — 컨트롤러가 사용자에게 `0003_keyword_pool.sql` 실행을 요청한다.

---

### Task 2: 순수 함수 — 파싱 · 로테이션 · OR 묶음 · 점수

**Files:**
- Create: `src/lib/trends/parseKeywordList.ts`, `pickRotation.ts`, `buildOrQueries.ts`, `scoreVideo.ts`
- Test: 각각의 `.test.ts`

**Interfaces:**
- Produces: `parseKeywordList(text: string): string[]`
- Produces: `RotationKeyword = { id: string; keyword: string; group_name: string | null; last_searched_on: string | null; created_at: string }`, `pickRotation<T extends RotationKeyword>(keywords: T[], n?: number): T[]` (기본 10)
- Produces: `buildOrQueries(picked: { keyword: string; group_name: string | null }[], perQuery?: number): string[]` (기본 4)
- Produces: `Scorable = { title: string; tags: string[]; description: string }`, `scoreVideo(video: Scorable, pool: string[]): { relevance: number; matched: string[] }`, `ScoredVideo = VideoDetail & { relevance: number; matched: string[] }`, `scoreAll(videos: VideoDetail[], pool: string[]): ScoredVideo[]`, `byRelevanceThenViews(a, b)`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/trends/parseKeywordList.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseKeywordList } from './parseKeywordList'

describe('parseKeywordList', () => {
  it('splits on commas and new lines and tidies spaces', () => {
    expect(parseKeywordList('glow up,  skincare   routine\nthat girl\r\n, girl talk ')).toEqual([
      'glow up',
      'skincare routine',
      'that girl',
      'girl talk',
    ])
  })

  it('drops empty entries and entries over 60 characters', () => {
    expect(parseKeywordList(`,,\n  \n${'x'.repeat(61)}\nok`)).toEqual(['ok'])
  })

  it('keeps the first of case-insensitive duplicates', () => {
    expect(parseKeywordList('Glow Up, glow up, GLOW UP, mindset')).toEqual(['Glow Up', 'mindset'])
  })
})
```

`src/lib/trends/pickRotation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pickRotation, type RotationKeyword } from './pickRotation'

let seq = 0
const k = (keyword: string, group_name: string | null, last_searched_on: string | null = null): RotationKeyword => ({
  id: keyword,
  keyword,
  group_name,
  last_searched_on,
  created_at: `2026-09-01T00:00:${String(seq++).padStart(2, '0')}Z`,
})
const names = (list: RotationKeyword[]) => list.map((x) => x.keyword)

describe('pickRotation', () => {
  it('takes one per group in turn, groups in alphabetical order with ungrouped last', () => {
    const list = [k('z1', null), k('b1', 'b'), k('a1', 'a'), k('a2', 'a'), k('b2', 'b')]
    expect(names(pickRotation(list, 4))).toEqual(['a1', 'b1', 'z1', 'a2'])
  })

  it('prefers never-searched, then the oldest search date', () => {
    const list = [k('recent', 'a', '2026-09-28'), k('old', 'a', '2026-09-01'), k('never', 'a', null)]
    expect(names(pickRotation(list, 2))).toEqual(['never', 'old'])
  })

  it('breaks ties by registration order', () => {
    const list = [k('first', 'a'), k('second', 'a')]
    expect(names(pickRotation(list, 1))).toEqual(['first'])
  })

  it('returns everything when there are fewer than n', () => {
    expect(names(pickRotation([k('only', null)], 10))).toEqual(['only'])
    expect(pickRotation([], 10)).toEqual([])
  })

  it('defaults to 10', () => {
    const list = Array.from({ length: 15 }, (_, i) => k(`w${i}`, 'g'))
    expect(pickRotation(list)).toHaveLength(10)
  })
})
```

`src/lib/trends/buildOrQueries.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildOrQueries } from './buildOrQueries'

const k = (keyword: string, group_name: string | null) => ({ keyword, group_name })

describe('buildOrQueries', () => {
  it('joins keywords of the same group with |', () => {
    expect(buildOrQueries([k('glow up', 'beauty'), k('mindset', 'self'), k('that girl', 'beauty')])).toEqual([
      'glow up|that girl',
      'mindset',
    ])
  })

  it('splits a group into chunks of at most 4', () => {
    const picked = ['a', 'b', 'c', 'd', 'e'].map((x) => k(x, 'g'))
    expect(buildOrQueries(picked)).toEqual(['a|b|c|d', 'e'])
  })

  it('treats null as its own group', () => {
    expect(buildOrQueries([k('x', null), k('y', null)])).toEqual(['x|y'])
  })

  it('returns [] for no keywords', () => {
    expect(buildOrQueries([])).toEqual([])
  })
})
```

`src/lib/trends/scoreVideo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { VideoDetail } from '@/lib/youtube/api'
import { byRelevanceThenViews, scoreAll, scoreVideo } from './scoreVideo'

const video = (title: string, tags: string[] = [], description = '') => ({ title, tags, description })

describe('scoreVideo', () => {
  it('gives 2 points per keyword in the title, case-insensitively', () => {
    expect(scoreVideo(video('My GLOW UP and That Girl routine'), ['glow up', 'that girl'])).toEqual({
      relevance: 4,
      matched: ['glow up', 'that girl'],
    })
  })

  it('gives 1 point for tags or description when not in the title', () => {
    expect(scoreVideo(video('Sunday vlog', ['self care'], 'talking about mindset today'), ['self care', 'mindset'])).toEqual({
      relevance: 2,
      matched: ['self care', 'mindset'],
    })
  })

  it('counts a keyword once, preferring the title', () => {
    expect(scoreVideo(video('mindset reset', ['mindset'], 'mindset'), ['mindset'])).toEqual({
      relevance: 2,
      matched: ['mindset'],
    })
  })

  it('lists title matches before tag/description matches', () => {
    expect(scoreVideo(video('habits that stick', ['glow up']), ['glow up', 'habits']).matched).toEqual([
      'habits',
      'glow up',
    ])
  })

  it('matches whole phrases only', () => {
    expect(scoreVideo(video('glowing up slowly'), ['glow up']).relevance).toBe(0)
    expect(scoreVideo(video('selfcare sunday'), ['self care']).relevance).toBe(0)
    expect(scoreVideo(video('glow up: part 2'), ['glow up']).relevance).toBe(2)
  })

  it('escapes regex characters in keywords', () => {
    expect(scoreVideo(video('how to be confident (really)'), ['how to be confident (really)']).relevance).toBe(2)
  })
})

describe('scoreAll / byRelevanceThenViews', () => {
  const v = (id: string, title: string, viewCount: number): VideoDetail => ({
    videoId: id,
    title,
    channelId: 'UC',
    channelTitle: 'C',
    viewCount,
    thumbnailUrl: '',
    durationSec: 600,
    categoryId: '22',
    publishedAt: '2026-09-25T00:00:00Z',
    tags: [],
    description: '',
  })

  it('sorts by relevance first, then by views', () => {
    const scored = scoreAll([v('a', 'random', 1000), v('b', 'glow up', 10), v('c', 'glow up', 50)], ['glow up'])
    expect(scored.sort(byRelevanceThenViews).map((x) => x.videoId)).toEqual(['c', 'b', 'a'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/trends`
Expected: FAIL — 새 모듈 4개를 찾을 수 없음. (`scoreVideo.test.ts`는 `VideoDetail.tags`가 아직 없어 타입상 맞지 않지만 Vitest는 타입을 검사하지 않으므로 모듈 누락으로 실패한다.)

- [ ] **Step 3: 구현**

`src/lib/trends/parseKeywordList.ts`:

```ts
const MAX_LENGTH = 60

/** 쉼표·줄바꿈으로 구분된 붙여넣기 텍스트를 키워드 목록으로 바꾼다. 대소문자만 다른 중복은 첫 번째만 남긴다. */
export function parseKeywordList(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of text.split(/[,\r\n]+/)) {
    const keyword = raw.trim().replace(/\s+/g, ' ')
    if (!keyword || keyword.length > MAX_LENGTH) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(keyword)
  }
  return result
}
```

`src/lib/trends/pickRotation.ts`:

```ts
export type RotationKeyword = {
  id: string
  keyword: string
  group_name: string | null
  last_searched_on: string | null
  created_at: string
}

/** 오래 검색하지 않은 순(한 번도 안 한 것 먼저), 같으면 등록 순 */
function byStaleness(a: RotationKeyword, b: RotationKeyword) {
  if (a.last_searched_on !== b.last_searched_on) {
    if (a.last_searched_on === null) return -1
    if (b.last_searched_on === null) return 1
    return a.last_searched_on < b.last_searched_on ? -1 : 1
  }
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}

/** 그룹을 가나다순(그룹 없음은 마지막)으로 돌며 각 그룹에서 가장 오래된 키워드를 하나씩 뽑아 n개를 채운다. */
export function pickRotation<T extends RotationKeyword>(keywords: T[], n = 10): T[] {
  const groups = new Map<string | null, T[]>()
  for (const k of keywords) groups.set(k.group_name, [...(groups.get(k.group_name) ?? []), k])
  const order = [...groups.keys()].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b),
  )
  const queues = order.map((g) => [...groups.get(g)!].sort(byStaleness))

  const picked: T[] = []
  while (picked.length < n && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      if (picked.length >= n) break
      const next = queue.shift()
      if (next) picked.push(next)
    }
  }
  return picked
}
```

`src/lib/trends/buildOrQueries.ts`:

```ts
/** 같은 그룹의 키워드를 최대 perQuery개씩 "a|b|c" 검색어로 묶는다. YouTube 검색은 | 를 OR로 해석한다. */
export function buildOrQueries(
  picked: { keyword: string; group_name: string | null }[],
  perQuery = 4,
): string[] {
  const groups = new Map<string | null, string[]>()
  for (const { keyword, group_name } of picked) {
    groups.set(group_name, [...(groups.get(group_name) ?? []), keyword])
  }
  const queries: string[] = []
  for (const keywords of groups.values()) {
    for (let i = 0; i < keywords.length; i += perQuery) {
      queries.push(keywords.slice(i, i + perQuery).join('|'))
    }
  }
  return queries
}
```

`src/lib/trends/scoreVideo.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/lib/trends`
Expected: 새 테스트 전부 통과 (기존 pickTrends 테스트 포함)

`npm run typecheck`는 `scoreVideo.test.ts`의 `VideoDetail`에 `tags`/`description`이 없어서 실패할 수 있다 — Task 3에서 `VideoDetail`에 추가된다. 이 태스크에서는 `npm run lint`만 통과하면 된다. (typecheck 실패가 이 두 필드 외의 이유라면 보고한다.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trends
git commit -m "feat: add keyword parsing, rotation, OR queries, and relevance scoring"
```

---

### Task 3: YouTube 레이어 — 태그·설명, 검색어 입력, 점수 정렬

**Files:**
- Modify: `src/lib/youtube/api.ts`, `src/lib/youtube/api.test.ts`, `src/lib/youtube/fakeYouTube.ts`, `src/lib/youtube/fetchKeywordVideos.ts`, `src/lib/youtube/fetchChannelVideos.ts`, `src/lib/youtube/fetchChannelVideos.test.ts`, `src/lib/trends/getTodayTrends.ts` (임시 연결)
- Replace: `src/lib/youtube/fetchKeywordVideos.test.ts`

**Interfaces:**
- Consumes: `scoreAll`, `byRelevanceThenViews`, `ScoredVideo` (Task 2)
- Produces: `VideoDetail`에 `tags: string[]; description: string`(설명 앞 500자)
- Produces: `fetchKeywordVideos({ apiKey, queries: string[], pool: string[], now, fetchImpl? }): Promise<ScoredVideo[]>` — relevance 0 제외, 관련도 → 조회수
- Produces: `fetchChannelVideos({ apiKey, playlistIds, pool: string[], now, fetchImpl? }): Promise<ScoredVideo[]>` — 관련도 → 조회수 정렬 후 채널당 2개

- [ ] **Step 1: 테스트 수정·작성 (먼저)**

`src/lib/youtube/fakeYouTube.ts`의 `rawVideo` 옵션에 `tags`, `description`을 추가한다. 시그니처와 snippet을 다음처럼 바꾼다:

```ts
export function rawVideo(
  id: string,
  {
    views = '100',
    duration = 'PT10M',
    category = '22',
    publishedAt = '2026-09-25T00:00:00Z',
    channelId = 'UCa',
    title = `Title ${id}`,
    tags,
    description,
  }: {
    views?: string
    duration?: string
    category?: string
    publishedAt?: string
    channelId?: string
    title?: string
    tags?: string[]
    description?: string
  } = {},
) {
  return {
    id,
    snippet: {
      title,
      channelId,
      channelTitle: `Channel ${channelId}`,
      categoryId: category,
      publishedAt,
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
      ...(tags ? { tags } : {}),
      ...(description !== undefined ? { description } : {}),
    },
    statistics: { viewCount: views },
    contentDetails: { duration },
  }
}
```

`src/lib/youtube/api.test.ts`의 첫 테스트(`maps fields including duration, category and publish date`) 기대값 객체에 두 줄을 추가하고, 태그·설명 매핑 테스트를 그 아래에 추가한다:

```ts
      tags: [],
      description: '',
```

```ts
  it('maps tags and truncates the description to 500 characters', async () => {
    const withText = {
      ...raw('b'),
      snippet: { ...raw('b').snippet, tags: ['glow up', 'vlog'], description: 'x'.repeat(600) },
    }
    const fetchImpl = vi.fn(async () => json({ items: [withText] }))
    const [v] = await fetchVideoDetails('k', ['b'], fetchImpl as unknown as typeof fetch)
    expect(v.tags).toEqual(['glow up', 'vlog'])
    expect(v.description).toHaveLength(500)
  })
```

`src/lib/youtube/fetchKeywordVideos.test.ts` 전체를 교체:

```ts
import { describe, expect, it } from 'vitest'
import { asFetch, callsTo, fakeYouTube, rawVideo } from './fakeYouTube'
import { fetchKeywordVideos } from './fetchKeywordVideos'

const now = new Date('2026-09-29T00:00:00Z')

describe('fetchKeywordVideos', () => {
  it('returns [] without calling the API when there are no queries', async () => {
    const yt = fakeYouTube({})
    expect(await fetchKeywordVideos({ apiKey: 'k', queries: [], pool: ['x'], now, fetchImpl: asFetch(yt) })).toEqual([])
    expect(yt).not.toHaveBeenCalled()
  })

  it('runs one search per OR query with 50 results by relevance', async () => {
    const yt = fakeYouTube({
      search: { 'glow up|that girl': ['a'], mindset: ['b'] },
      videos: [rawVideo('a', { title: 'glow up' }), rawVideo('b', { title: 'mindset' })],
    })
    await fetchKeywordVideos({
      apiKey: 'k',
      queries: ['glow up|that girl', 'mindset'],
      pool: ['glow up', 'mindset'],
      now,
      fetchImpl: asFetch(yt),
    })

    const searches = callsTo(yt, '/search')
    expect(searches.map((u) => u.searchParams.get('q'))).toEqual(['glow up|that girl', 'mindset'])
    for (const u of searches) {
      const p = u.searchParams
      expect(p.get('type')).toBe('video')
      expect(p.get('order')).toBe('relevance')
      expect(p.get('maxResults')).toBe('50')
      expect(p.get('relevanceLanguage')).toBe('en')
      expect(p.get('regionCode')).toBe('US')
      expect(p.get('publishedAfter')).toBe('2026-09-22T00:00:00.000Z')
    }
  })

  it('drops Shorts, off-niche categories and zero-relevance videos; sorts by relevance then views', async () => {
    const pool = ['glow up', 'that girl', 'mindset']
    const yt = fakeYouTube({
      search: { q: ['two', 'oneBig', 'oneSmall', 'none', 'short', 'music'] },
      videos: [
        rawVideo('two', { views: '5', title: 'glow up with that girl' }),
        rawVideo('oneBig', { views: '900', title: 'my mindset shift' }),
        rawVideo('oneSmall', { views: '10', title: 'weekly vlog', tags: ['mindset'] }),
        rawVideo('none', { views: '99999', title: 'random stuff' }),
        rawVideo('short', { views: '999', title: 'glow up', duration: 'PT59S' }),
        rawVideo('music', { views: '999', title: 'glow up', category: '10' }),
      ],
    })
    const result = await fetchKeywordVideos({ apiKey: 'k', queries: ['q'], pool, now, fetchImpl: asFetch(yt) })

    expect(result.map((v) => [v.videoId, v.relevance])).toEqual([
      ['two', 4],
      ['oneBig', 2],
      ['oneSmall', 1],
    ])
    expect(result[0].matched).toEqual(['glow up', 'that girl'])
  })
})
```

`src/lib/youtube/fetchChannelVideos.test.ts`: 기존의 모든 `fetchChannelVideos({ ... })` 호출 인자에 `pool: [],`를 추가하고, 다음 테스트를 추가한다:

```ts
  it('ranks by relevance before views, then applies the per-channel cap', async () => {
    const yt = fakeYouTube({
      playlists: { UUa: ['popular', 'onNiche1', 'onNiche2'] },
      videos: [
        rawVideo('popular', { views: '9999', channelId: 'UCa', title: 'random' }),
        rawVideo('onNiche1', { views: '10', channelId: 'UCa', title: 'glow up diaries' }),
        rawVideo('onNiche2', { views: '20', channelId: 'UCa', title: 'glow up routine' }),
      ],
    })
    const result = await fetchChannelVideos({
      apiKey: 'k',
      playlistIds: ['UUa'],
      pool: ['glow up'],
      now,
      fetchImpl: asFetch(yt),
    })
    expect(result.map((v) => v.videoId)).toEqual(['onNiche2', 'onNiche1'])
  })
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/youtube`
Expected: FAIL — tags/description 매핑, `queries`/`pool` 입력, 관련도 정렬이 아직 없음

- [ ] **Step 3: 구현**

`src/lib/youtube/api.ts`:
- `VideoDetail`에 두 필드 추가:

```ts
  tags: string[]
  description: string
```

- `VideosResponse`의 `snippet` 타입에 `tags?: string[]`, `description?: string` 추가.
- `details.push({ ... })`에 두 줄 추가 (`publishedAt` 다음):

```ts
        tags: v.snippet.tags ?? [],
        description: (v.snippet.description ?? '').slice(0, 500),
```

`src/lib/youtube/fetchKeywordVideos.ts` 전체 교체:

```ts
import { byRelevanceThenViews, scoreAll, type ScoredVideo } from '@/lib/trends/scoreVideo'
import { fetchVideoDetails, getJson, MAX_SHORTS_SEC, YOUTUBE_API } from './api'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** 수다·스토리텔링 니치가 주로 속한 카테고리: People & Blogs, Comedy, Entertainment, Howto & Style */
export const NICHE_CATEGORY_IDS = new Set(['22', '23', '24', '26'])

type SearchResponse = { items?: { id?: { videoId?: string } }[] }

/**
 * OR 검색어("a|b|c")마다 영어권 최근 7일 영상을 관련도 순으로 50개씩 찾고,
 * 숏츠·니치 밖 카테고리·풀 키워드와 하나도 안 맞는 영상을 걸러 관련도 → 조회수 순으로 돌려준다.
 * 할당량: search 100 units × 검색어 수 + videos 1 unit/50개.
 */
export async function fetchKeywordVideos({
  apiKey,
  queries,
  pool,
  now,
  fetchImpl = fetch,
}: {
  apiKey: string
  queries: string[]
  pool: string[]
  now: Date
  fetchImpl?: typeof fetch
}): Promise<ScoredVideo[]> {
  if (queries.length === 0) return []

  const publishedAfter = new Date(now.getTime() - WEEK_MS).toISOString()
  const idLists = await Promise.all(
    queries.map(async (q) => {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q,
        relevanceLanguage: 'en',
        regionCode: 'US',
        order: 'relevance',
        publishedAfter,
        maxResults: '50',
        key: apiKey,
      })
      const data = await getJson<SearchResponse>(fetchImpl, `${YOUTUBE_API}/search?${params}`)
      return (data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => !!id)
    }),
  )

  const ids = [...new Set(idLists.flat())]
  if (ids.length === 0) return []

  const videos = (await fetchVideoDetails(apiKey, ids, fetchImpl)).filter(
    (v) => v.durationSec > MAX_SHORTS_SEC && NICHE_CATEGORY_IDS.has(v.categoryId),
  )
  return scoreAll(videos, pool)
    .filter((v) => v.relevance > 0)
    .sort(byRelevanceThenViews)
}
```

`src/lib/youtube/fetchChannelVideos.ts`:
- import 추가: `import { byRelevanceThenViews, scoreAll, type ScoredVideo } from '@/lib/trends/scoreVideo'`, 그리고 `api.ts` import 목록에서 `byViewsDesc`와 `type VideoDetail`을 뺀다(쓰지 않게 됨).
- 인자에 `pool` 추가, 반환 타입을 `Promise<ScoredVideo[]>`로:

```ts
export async function fetchChannelVideos({
  apiKey,
  playlistIds,
  pool,
  now,
  fetchImpl = fetch,
}: {
  apiKey: string
  playlistIds: string[]
  pool: string[]
  now: Date
  fetchImpl?: typeof fetch
}): Promise<ScoredVideo[]> {
```

- 필터·정렬 부분을 교체:

```ts
  const since = now.getTime() - WINDOW_MS
  const recent = (await fetchVideoDetails(apiKey, ids, fetchImpl)).filter(
    (v) => v.durationSec > MAX_SHORTS_SEC && Date.parse(v.publishedAt) >= since,
  )
  const videos = scoreAll(recent, pool).sort(byRelevanceThenViews)
```

- 함수 위 주석의 "조회수 순으로"를 "관련도 → 조회수 순으로"로 고친다.

`src/lib/trends/getTodayTrends.ts` (Task 4에서 전체 교체하므로 최소 연결만):
- `fetchChannelVideos({ apiKey, playlistIds, now })` → `fetchChannelVideos({ apiKey, playlistIds, pool: keywords, now })`
- `fetchKeywordVideos({ apiKey, keywords, now })` → `fetchKeywordVideos({ apiKey, queries: keywords, pool: keywords, now })`

- [ ] **Step 4: 통과 확인**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 전부 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube src/lib/trends/getTodayTrends.ts
git commit -m "feat: score YouTube candidates by keyword relevance"
```

---

### Task 4: getTodayTrends 로테이션 · 저장 · 위젯 태그

**Files:**
- Modify: `src/lib/trends/pickTrends.ts`, `src/lib/trends/getTodayTrends.ts` (전체 교체), `src/features/trends/TrendsWidget.tsx`

**Interfaces:**
- Consumes: `pickRotation`, `buildOrQueries`, `ScoredVideo`, `fetchKeywordVideos`, `fetchChannelVideos`
- Produces: `pickTrends<T extends VideoDetail>(channel: T[], keyword: T[], perSource?, total?): (T & { source: TrendSource })[]`, `PickedTrend<T extends VideoDetail = VideoDetail>`

- [ ] **Step 1: pickTrends 제네릭화**

`src/lib/trends/pickTrends.ts`에서 타입과 시그니처만 바꾼다 (본문 로직은 그대로):

```ts
export type PickedTrend<T extends VideoDetail = VideoDetail> = T & { source: TrendSource }
```

```ts
export function pickTrends<T extends VideoDetail>(
  channel: T[],
  keyword: T[],
  perSource = 4,
  total = 8,
): PickedTrend<T>[] {
```

본문의 `keywordNotIn`의 매개변수 타입 `VideoDetail[]`는 `T[]`로 바꾼다.

Run: `npm test -- src/lib/trends/pickTrends.test.ts`
Expected: 기존 테스트 통과

- [ ] **Step 2: getTodayTrends 전체 교체**

`src/lib/trends/getTodayTrends.ts`:

```ts
import { requireUser } from '@/lib/auth/requireUser'
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import type { TrendTopic } from '@/lib/types'
import { fetchChannelVideos } from '@/lib/youtube/fetchChannelVideos'
import { fetchKeywordVideos } from '@/lib/youtube/fetchKeywordVideos'
import { buildOrQueries } from './buildOrQueries'
import { pickRotation, type RotationKeyword } from './pickRotation'
import { pickTrends } from './pickTrends'

export type TrendsResult =
  | { status: 'ok'; topics: TrendTopic[] }
  | { status: 'no-sources' }
  | { status: 'failed'; fallback: TrendTopic[]; fetchedOn: string | null }

/** 하루에 검색하는 키워드 수. 같은 그룹끼리 OR로 묶이므로 실제 검색 호출은 더 적다. */
const ROTATION_SIZE = 10
/** 서버 액션이 등록을 10개로 막지만, 직접 insert로 우회될 수 있어 조회에서도 제한한다. */
const MAX_CHANNELS = 10

/**
 * 오늘(한국 시간) 저장된 트렌드가 있으면 그대로, 없으면 로테이션으로 고른 키워드와 벤치마킹 채널로
 * YouTube에서 가져와 관련도 점수와 함께 저장한다. 실패하면 저장하지 않고 가장 최근 날짜의 트렌드를 돌려준다.
 */
export async function getTodayTrends(workspaceId: string): Promise<TrendsResult> {
  await requireUser()
  const supabase = await createClient()
  const today = seoulDateString(new Date())

  const todays = () =>
    supabase
      .from('trend_topics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('fetched_on', today)
      .order('relevance', { ascending: false })
      .order('view_count', { ascending: false })

  /** 조회 자체가 실패했을 때 쓰는 폴백 — 가장 최근 날짜의 트렌드를 돌려준다. */
  const fallback = async (): Promise<TrendsResult> => {
    const { data: latest } = await supabase
      .from('trend_topics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('fetched_on', { ascending: false })
      .order('relevance', { ascending: false })
      .order('view_count', { ascending: false })
      .limit(8)
    const rows = (latest ?? []) as TrendTopic[]
    const fetchedOn = rows[0]?.fetched_on ?? null
    return { status: 'failed', fallback: rows.filter((r) => r.fetched_on === fetchedOn), fetchedOn }
  }

  const existing = await todays()
  if (existing.error) return fallback()
  if (existing.data && existing.data.length > 0) {
    return { status: 'ok', topics: existing.data as TrendTopic[] }
  }

  const [keywordRes, channelRes] = await Promise.all([
    supabase
      .from('trend_keywords')
      .select('id, keyword, group_name, last_searched_on, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at'),
    supabase
      .from('benchmark_channels')
      .select('uploads_playlist_id')
      .eq('workspace_id', workspaceId)
      .order('created_at')
      .limit(MAX_CHANNELS),
  ])
  if (keywordRes.error || channelRes.error) return fallback()
  const keywordRows = (keywordRes.data ?? []) as RotationKeyword[]
  const playlistIds = (channelRes.data ?? []).map((r) => r.uploads_playlist_id as string)
  if (keywordRows.length === 0 && playlistIds.length === 0) return { status: 'no-sources' }

  const pool = keywordRows.map((k) => k.keyword)
  const rotation = pickRotation(keywordRows, ROTATION_SIZE)
  const queries = buildOrQueries(rotation)

  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

    const now = new Date()
    const [channelVideos, keywordVideos] = await Promise.all([
      fetchChannelVideos({ apiKey, playlistIds, pool, now }),
      fetchKeywordVideos({ apiKey, queries, pool, now }),
    ])
    const picked = pickTrends(channelVideos, keywordVideos)

    if (picked.length > 0) {
      const { error } = await supabase.from('trend_topics').upsert(
        picked.map((v) => ({
          workspace_id: workspaceId,
          fetched_on: today,
          video_id: v.videoId,
          title: v.title,
          channel_title: v.channelTitle,
          view_count: v.viewCount,
          thumbnail_url: v.thumbnailUrl,
          source: v.source,
          relevance: v.relevance,
          matched_keywords: v.matched,
        })),
        // 탭 두 개가 동시에 갱신해도 중복 저장되지 않는다.
        { onConflict: 'workspace_id,fetched_on,video_id', ignoreDuplicates: true },
      )
      if (error) throw new Error(error.message)
    }

    if (rotation.length > 0) {
      // 로테이션 기록 실패는 결과에 영향을 주지 않는다 (다음 날 덜 골고루 돌 뿐).
      const { error: rotationError } = await supabase
        .from('trend_keywords')
        .update({ last_searched_on: today })
        .in(
          'id',
          rotation.map((k) => k.id),
        )
      if (rotationError) console.error('[trends] rotation update failed:', rotationError.message)
    }

    const saved = await todays()
    return { status: 'ok', topics: (saved.data ?? []) as TrendTopic[] }
  } catch (err) {
    console.error('[trends] refresh failed:', err)
    return fallback()
  }
}
```

- [ ] **Step 3: 위젯에 매칭 키워드 태그**

`src/features/trends/TrendsWidget.tsx`의 `renderTopic`에서 조회수 `<p>` 바로 다음(고정 버튼 앞)에 추가:

```tsx
          {topic.matched_keywords.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {topic.matched_keywords.slice(0, 3).map((keyword) => (
                <span key={keyword} className="rounded bg-gray-100 px-1 text-[11px] text-gray-600">
                  {keyword}
                </span>
              ))}
            </div>
          )}
```

- [ ] **Step 4: 검증**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 전부 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/trends src/features/trends/TrendsWidget.tsx
git commit -m "feat: rotate keywords into OR searches and store relevance"
```

---

### Task 5: 키워드 일괄 추가 · 그룹별 설정 화면

**Files:**
- Create: `src/features/trends/keywordActions.ts`
- Replace: `src/features/trends/KeywordSettings.tsx`

**Interfaces:**
- Consumes: `parseKeywordList`, `requireUser`, `createClient`(server), `useLiveList`, `useWorkspaceId`, `keywordsData`(`./data`), `TrendKeyword`
- Produces: `AddKeywordsError = 'invalid' | 'limit' | 'failed'`, `addKeywords(workspaceId: string, groupName: string, text: string): Promise<{ ok: true; rows: TrendKeyword[]; added: number; skipped: number; truncated: number } | { error: AddKeywordsError }>`

- [ ] **Step 1: Server Action**

`src/features/trends/keywordActions.ts`:

```ts
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
  const group = groupName.trim().replace(/\s+/g, ' ').slice(0, MAX_GROUP_LENGTH) || null

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
```

- [ ] **Step 2: 설정 컴포넌트 전체 교체**

`src/features/trends/KeywordSettings.tsx`:

```tsx
'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { TrendKeyword } from '@/lib/types'
import { keywordsData } from './data'
import { addKeywords, type AddKeywordsError } from './keywordActions'

const byKeyword = (a: TrendKeyword, b: TrendKeyword) => a.keyword.localeCompare(b.keyword)

type Notice =
  | { kind: 'added'; added: number; skipped: number; truncated: number }
  | { kind: 'error'; error: AddKeywordsError }

export function KeywordSettings({ initial }: { initial: TrendKeyword[] }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('trend_keywords', initial, byKeyword)
  const [group, setGroup] = useState('')
  const [text, setText] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [adding, startAdd] = useTransition()

  const groupNames = [...new Set(rows.map((r) => r.group_name).filter((g): g is string => !!g))].sort(
    (a, b) => a.localeCompare(b),
  )
  const sections: [string | null, TrendKeyword[]][] = [
    ...groupNames.map((g): [string | null, TrendKeyword[]] => [g, rows.filter((r) => r.group_name === g)]),
    [null, rows.filter((r) => !r.group_name)],
  ].filter(([, list]) => list.length > 0)

  function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setNotice(null)
    startAdd(async () => {
      const result = await addKeywords(workspaceId, group, text)
      if ('error' in result) {
        setNotice({ kind: 'error', error: result.error })
        return
      }
      setText('')
      setNotice({ kind: 'added', added: result.added, skipped: result.skipped, truncated: result.truncated })
      // 서버에서 이미 저장됐다 — 화면에만 바로 반영한다. 뒤이어 오는 Realtime 이벤트는 같은 id라 중복되지 않는다.
      for (const row of result.rows) void mutate({ type: 'INSERT', row }, async () => ({ error: null }))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">{t('keywordsHelp')}</p>

      {notice?.kind === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t(`keywordErrors.${notice.error}`)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {tc('saveFailed')}
        </p>
      )}
      {notice?.kind === 'added' && (
        <p role="status" className="text-sm text-green-700">
          {t('keywordsAdded', { added: notice.added, skipped: notice.skipped })}
          {notice.truncated > 0 && ` ${t('keywordsTruncated', { count: notice.truncated })}`}
        </p>
      )}

      <form onSubmit={add} className="flex flex-col gap-2">
        <input
          aria-label={t('keywordGroupLabel')}
          placeholder={t('keywordGroupLabel')}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          list="keyword-groups"
          maxLength={30}
          className="rounded border border-gray-300 px-2 py-1"
        />
        <datalist id="keyword-groups">
          {groupNames.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <textarea
          aria-label={t('keywordLabel')}
          placeholder={t('keywordsPlaceholder')}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (notice?.kind === 'error') setNotice(null)
          }}
          rows={3}
          className="rounded border border-gray-300 px-2 py-1"
        />
        <button
          type="submit"
          disabled={adding}
          className="self-end rounded bg-gray-900 px-3 py-1 text-white disabled:opacity-50"
        >
          {tc('add')}
        </button>
      </form>

      {sections.length === 0 ? (
        <p className="text-sm text-gray-500">{t('keywordsEmpty')}</p>
      ) : (
        sections.map(([name, list]) => (
          <div key={name ?? '__none__'}>
            <h4 className="mb-1 text-xs font-medium text-gray-500">
              {name ?? t('ungroupedKeywords')} <span className="text-gray-400">{list.length}</span>
            </h4>
            <ul className="flex flex-wrap gap-1">
              {list.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-sm"
                >
                  {row.keyword}
                  <button
                    type="button"
                    aria-label={`${tc('delete')} ${row.keyword}`}
                    onClick={() =>
                      void mutate({ type: 'DELETE', id: row.id }, () => keywordsData.remove(row.id))
                    }
                    className="text-gray-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 3: 검증**

Run: `grep -rn "keywordDuplicate" src messages` → 결과 없음이어야 한다.
Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 전부 통과

- [ ] **Step 4: Commit**

```bash
git add src/features/trends
git commit -m "feat: bulk-add grouped keywords in settings"
```

---

### Task 6: 브라우저 검증 (컨트롤러)

사용자가 `0003_keyword_pool.sql`을 실행한 뒤 확인한다. 브라우저 탭은 앞으로 가져온 상태에서 확인한다(백그라운드 탭은 Suspense 표시가 멈춘다).

- [ ] 설정: 그룹 입력 + 여러 줄 붙여넣기 → "N개 추가 (중복 M개 건너뜀)", 그룹별 소제목, 그룹 자동완성
- [ ] 같은 목록 재입력 → 전부 중복으로 건너뜀, 빈 입력 → 안내
- [ ] 다시 가져오기 → 위젯 카드에 매칭 키워드 태그, 관련도 높은 영상이 먼저
- [ ] Supabase에서 `trend_keywords.last_searched_on`이 10개만 오늘 날짜로 바뀌었는지 확인 → 다시 가져오기를 한 번 더 누르면 다른 키워드 10개가 뽑히는지(서버 로그 또는 `last_searched_on`으로 확인)
- [ ] 서버 에러 로그 없음, English 전환 시 새 문구
