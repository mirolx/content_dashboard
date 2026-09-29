# 트렌드 추천 개선 (벤치마킹 채널 + 니치 필터) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트렌드 위젯이 사용자가 등록한 벤치마킹 채널의 최근 인기 영상 4개와, 숏츠·니치 밖 카테고리를 걸러낸 키워드 추천 4개를 두 묶음으로 보여주게 한다.

**Architecture:** YouTube 호출은 네트워크를 주입받는 순수 함수들(`api.ts`, `fetchKeywordVideos`, `fetchChannelVideos`, `lookupChannel`)로 나누고 가짜 fetch로 테스트한다. 두 소스의 후보는 순수 함수 `pickTrends`가 4+4로 합친다. 서버 함수 `getTodayTrends`가 이를 조립해 `trend_topics`에 `source`와 함께 하루 한 번 저장한다. 채널 등록은 API 키 보호를 위해 Server Action으로, 삭제와 목록 동기화는 기존 `useLiveList` 패턴으로 처리한다.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres/RLS/Realtime), next-intl 4, zod 4, Vitest 5, YouTube Data API v3.

**Spec:** `docs/superpowers/specs/2026-09-29-trend-sources-design.md`

## Global Constraints

- 숏츠 제외: `contentDetails.duration` **180초 이하** 영상은 버린다.
- 벤치마킹 채널: 업로드 재생목록 `playlistItems.list` `maxResults=20`, 최근 **30일**, **채널당 최대 2개**, 카테고리 필터 없음. 워크스페이스당 채널 **최대 10개**.
- 키워드: `search.list` `order=relevance`, `maxResults=25`, `relevanceLanguage=en`, `regionCode=US`, `type=video`, 최근 7일, 키워드 등록 순 최대 5개. 카테고리 **22, 23, 24, 26**만.
- 합치기: 채널 최대 4 + 키워드 최대 4, 한쪽이 모자라면 다른 쪽으로 채움, 총 최대 8, 같은 영상은 채널 쪽에만.
- 한 소스라도 실패하면 전체 실패(저장 안 함, 최근 저장분 폴백). 삭제·비공개 채널의 `playlistItems` 404는 그 채널만 건너뛴다.
- 모든 UI 문구는 `messages/ko.json`, `messages/en.json`에 두고 키 구성이 같아야 한다.
- Server Action과 서버 함수는 `requireUser()`로 로그인을 재확인한다. `YOUTUBE_API_KEY`는 서버 전용.
- 새 행의 id는 `newId()`(`@/lib/id`), Supabase 쓰기 실패 시 롤백은 `useLiveList`가 담당.
- 디자인 없음: 기본 Tailwind만. 에이전트는 키 값을 입력하거나 출력하지 않는다.
- 이 저장소의 Next.js는 16이다. `AGENTS.md` 안내대로 API가 의심되면 `node_modules/next/dist/docs/`를 확인한다. `'use server'` 파일은 async 함수만 export할 수 있다(타입 export는 가능).

## File Map

| 파일 | 책임 |
|---|---|
| `supabase/migrations/0002_trend_sources.sql` | `benchmark_channels` 테이블·RLS·Realtime, `trend_topics.source` |
| `src/lib/types.ts` (수정) | `BenchmarkChannel`, `TrendSource`, `TrendTopic.source`, `WORKSPACE_TABLES`에 `benchmark_channels` |
| `src/lib/youtube/parseDuration.ts` | ISO 8601 길이 → 초 |
| `src/lib/youtube/parseChannelInput.ts` | 사용자 입력 → `ChannelQuery` |
| `src/lib/youtube/api.ts` | `YOUTUBE_API`, `MAX_SHORTS_SEC`, `YouTubeApiError`, `getJson`, `VideoDetail`, `fetchVideoDetails`, `byViewsDesc` |
| `src/lib/youtube/fakeYouTube.ts` | 테스트용 가짜 YouTube fetch (테스트에서만 import) |
| `src/lib/youtube/fetchKeywordVideos.ts` | 키워드 후보 |
| `src/lib/youtube/fetchChannelVideos.ts` | 채널 후보 |
| `src/lib/youtube/lookupChannel.ts` | 채널 조회 |
| `src/lib/trends/pickTrends.ts` | 4+4 합치기 |
| `src/lib/trends/getTodayTrends.ts` (재작성) | 두 소스 조회·저장·폴백 |
| `src/features/trends/TrendsWidget.tsx` (수정) | 두 묶음 표시 |
| `src/features/trends/channelActions.ts` | `addBenchmarkChannel` Server Action |
| `src/features/trends/channelData.ts` | 채널 삭제용 `tableData` |
| `src/features/trends/ChannelSettings.tsx` | 설정의 채널 섹션 |
| `src/features/trends/RefetchTrends.tsx` | "오늘 트렌드 다시 가져오기" (KeywordSettings에서 분리) |
| `src/features/trends/KeywordSettings.tsx` (수정) | 다시 가져오기 부분 제거 |
| `src/app/(app)/[platform]/settings/page.tsx` (수정) | 섹션 배치 |
| 삭제: `src/lib/youtube/fetchTrends.ts`, `fetchTrends.test.ts` | `fetchKeywordVideos`로 대체 |

---

### Task 1: DB 마이그레이션 · 타입 · 메시지

**Files:**
- Create: `supabase/migrations/0002_trend_sources.sql`
- Modify: `src/lib/types.ts`, `messages/ko.json`, `messages/en.json`

**Interfaces:**
- Produces: `TrendSource = 'channel' | 'keyword'`, `TrendTopic.source: TrendSource`, `BenchmarkChannel = WorkspaceRow & { channel_id: string; handle: string | null; title: string; thumbnail_url: string; uploads_playlist_id: string }`, `WORKSPACE_TABLES`에 `'benchmark_channels'` 추가
- Produces 메시지 키: `trends.noSources`, `trends.fromChannels`, `trends.fromKeywords` (`trends.noKeywords` 삭제), `settings.benchmarkChannels`, `settings.channelsHelp`, `settings.channelLabel`, `settings.channelsEmpty`, `settings.channelErrors.{invalid,limit,notFound,duplicate,failed}`, `settings.refetchTitle`, `settings.keywordsHelp`(문구 변경)

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/0002_trend_sources.sql`:

```sql
-- 트렌드 추천 개선: 벤치마킹 채널 + 트렌드 출처
-- Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 실행한다. (0001 다음에 한 번)

create table public.benchmark_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  channel_id text not null,
  handle text,
  title text not null,
  thumbnail_url text not null default '',
  uploads_playlist_id text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, channel_id)
);

alter table public.benchmark_channels enable row level security;

create policy "benchmark_channels: select own" on public.benchmark_channels
  for select to authenticated using (user_id = (select auth.uid()));
create policy "benchmark_channels: insert own" on public.benchmark_channels
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_workspace(workspace_id));
create policy "benchmark_channels: delete own" on public.benchmark_channels
  for delete to authenticated using (user_id = (select auth.uid()));

-- 기본 권한을 걷어내고 필요한 것만 부여한다 (채널 정보는 수정하지 않는다).
revoke all on public.benchmark_channels from anon, authenticated;
grant select, insert, delete on public.benchmark_channels to authenticated;

alter publication supabase_realtime add table public.benchmark_channels;

-- 트렌드가 어느 소스에서 왔는지. 기존 행은 키워드 검색 결과다.
alter table public.trend_topics
  add column source text not null default 'keyword'
  check (source in ('channel', 'keyword'));
```

- [ ] **Step 2: 타입 수정**

`src/lib/types.ts`에서 `WORKSPACE_TABLES` 배열 마지막에 `'benchmark_channels',`를 추가한다:

```ts
export const WORKSPACE_TABLES = [
  'schedule_items',
  'checklist_items',
  'kanban_cards',
  'pinned_ideas',
  'reference_items',
  'hashtags',
  'trend_keywords',
  'benchmark_channels',
] as const
```

`TrendTopic` 정의를 아래로 교체하고, 바로 위에 `TrendSource`를, 바로 아래에 `BenchmarkChannel`을 추가한다:

```ts
export type TrendSource = 'channel' | 'keyword'

export type TrendTopic = WorkspaceRow & {
  fetched_on: string
  video_id: string
  title: string
  channel_title: string
  view_count: number
  thumbnail_url: string
  source: TrendSource
}

export type BenchmarkChannel = WorkspaceRow & {
  channel_id: string
  handle: string | null
  title: string
  thumbnail_url: string
  uploads_playlist_id: string
}
```

- [ ] **Step 3: 메시지 수정 (ko)**

`messages/ko.json`의 `"trends"` 객체에서 `"noKeywords"` 줄을 지우고 다음 세 키를 추가한다 (`"goToSettings"` 앞):

```json
    "noSources": "추천에 쓸 벤치마킹 채널이나 키워드가 없어요.",
    "fromChannels": "📺 벤치마킹 채널",
    "fromKeywords": "🔍 키워드 추천",
```

`"settings"` 객체의 `"keywordsHelp"` 값을 교체하고, `"refetchFailed"` 뒤에 새 키를 추가한다:

```json
    "keywordsHelp": "관련도 순으로 영어권 YouTube 최근 7일 영상을 찾고, 3분 이하 영상과 니치 밖 카테고리는 제외해요. 한 번 조회할 때 최대 5개 키워드까지 사용해요.",
```

```json
    "refetchFailed": "트렌드를 가져오지 못했어요.",
    "refetchTitle": "오늘 트렌드",
    "benchmarkChannels": "벤치마킹 채널",
    "channelsHelp": "좋아하는 크리에이터 채널을 등록하면 최근 30일 동안 올라온 3분 넘는 영상 중 조회수가 높은 영상을 추천해요. 최대 10개까지 등록할 수 있어요.",
    "channelLabel": "@핸들 또는 채널 URL",
    "channelsEmpty": "등록된 채널이 없어요.",
    "channelErrors": {
      "invalid": "입력 형식을 확인해 주세요. 예: @handle 또는 채널 URL",
      "limit": "최대 10개까지 등록할 수 있어요.",
      "notFound": "채널을 찾지 못했어요.",
      "duplicate": "이미 등록된 채널이에요.",
      "failed": "채널을 추가하지 못했어요. 잠시 후 다시 시도해 주세요."
    }
```

- [ ] **Step 4: 메시지 수정 (en)**

`messages/en.json`의 `"trends"`에서 `"noKeywords"`를 지우고 추가:

```json
    "noSources": "You have no benchmark channels or keywords to recommend from.",
    "fromChannels": "📺 Benchmark channels",
    "fromKeywords": "🔍 Keyword picks",
```

`"settings"`:

```json
    "keywordsHelp": "We search recent English YouTube videos (last 7 days) by relevance and skip videos under 3 minutes and off-niche categories. Up to 5 keywords are used.",
```

```json
    "refetchFailed": "Couldn't fetch trends.",
    "refetchTitle": "Today's trends",
    "benchmarkChannels": "Benchmark channels",
    "channelsHelp": "Add creators you admire and we'll recommend their most-viewed videos over 3 minutes from the last 30 days. Up to 10 channels.",
    "channelLabel": "@handle or channel URL",
    "channelsEmpty": "No channels yet.",
    "channelErrors": {
      "invalid": "Check the format, e.g. @handle or a channel URL.",
      "limit": "You can add up to 10 channels.",
      "notFound": "We couldn't find that channel.",
      "duplicate": "That channel is already added.",
      "failed": "Couldn't add the channel. Please try again."
    }
```

- [ ] **Step 5: 검증**

Run: `npm test -- src/i18n`
Expected: messages 테스트 통과 (키 구성 일치)

Run: `npm run typecheck`
Expected: `src/features/trends/TrendsWidget.tsx`에서 오류가 날 수 있다 — `result.status === 'no-keywords'` 비교는 아직 유효하므로 오류가 없어야 정상. `TrendTopic.source` 추가로 오류가 나는 곳이 있으면 그 파일 이름을 보고서에 적는다(Task 4에서 해당 코드를 교체한다). `trends.noKeywords` 키 삭제는 타입 오류를 만들지 않는다.

Run: `npm run lint`
Expected: 통과

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_trend_sources.sql src/lib/types.ts messages/ko.json messages/en.json
git commit -m "feat: add benchmark channels table and trend source column"
```

- [ ] **Step 7: ⏸ 사용자 체크포인트**

컨트롤러가 사용자에게 `0002_trend_sources.sql`을 Supabase SQL Editor에서 실행해 달라고 요청한다. **실행 전에는 대시보드의 Realtime 구독 전체가 실패할 수 있다** (`benchmark_channels`가 구독 대상에 들어갔으므로). 브라우저 확인은 실행 후에 한다.

---

### Task 2: YouTube 공용 유틸 — 길이·입력 파싱·영상 상세

**Files:**
- Create: `src/lib/youtube/parseDuration.ts`, `src/lib/youtube/parseChannelInput.ts`, `src/lib/youtube/api.ts`
- Test: `src/lib/youtube/parseDuration.test.ts`, `src/lib/youtube/parseChannelInput.test.ts`, `src/lib/youtube/api.test.ts`

**Interfaces:**
- Produces: `parseDuration(iso: string): number`
- Produces: `ChannelQuery = { handle: string } | { channelId: string }`, `parseChannelInput(input: string): ChannelQuery | null`
- Produces (api.ts): `YOUTUBE_API`, `MAX_SHORTS_SEC = 180`, `class YouTubeApiError { status: number }`, `getJson<T>(fetchImpl, url): Promise<T>`, `VideoDetail = { videoId; title; channelId; channelTitle; viewCount: number; thumbnailUrl; durationSec: number; categoryId: string; publishedAt: string }`, `fetchVideoDetails(apiKey: string, ids: string[], fetchImpl?: typeof fetch): Promise<VideoDetail[]>`, `byViewsDesc(a, b)`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/youtube/parseDuration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseDuration } from './parseDuration'

describe('parseDuration', () => {
  it.each([
    ['PT12M3S', 723],
    ['PT1H', 3600],
    ['PT45S', 45],
    ['PT3M', 180],
    ['P1DT1S', 86401],
    ['P0D', 0],
  ])('%s → %i seconds', (iso, seconds) => {
    expect(parseDuration(iso)).toBe(seconds)
  })

  it('returns 0 for unparseable input', () => {
    expect(parseDuration('')).toBe(0)
    expect(parseDuration('12:03')).toBe(0)
  })
})
```

`src/lib/youtube/parseChannelInput.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseChannelInput } from './parseChannelInput'

const ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'

describe('parseChannelInput', () => {
  it.each([
    ['@yapper', { handle: 'yapper' }],
    ['  @yap.per_1  ', { handle: 'yap.per_1' }],
    ['youtube.com/@yapper', { handle: 'yapper' }],
    ['https://www.youtube.com/@yapper/videos', { handle: 'yapper' }],
    ['https://m.youtube.com/@yapper', { handle: 'yapper' }],
    [`https://www.youtube.com/channel/${ID}`, { channelId: ID }],
    [ID, { channelId: ID }],
  ])('parses %s', (input, expected) => {
    expect(parseChannelInput(input)).toEqual(expected)
  })

  it.each([
    [''],
    ['yapper'],
    ['@a'],
    ['https://example.com/@yapper'],
    ['https://www.youtube.com/watch?v=abc123'],
    ['https://www.youtube.com/channel/not-an-id'],
  ])('rejects %s', (input) => {
    expect(parseChannelInput(input)).toBeNull()
  })
})
```

`src/lib/youtube/api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { byViewsDesc, fetchVideoDetails, YouTubeApiError } from './api'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function raw(id: string) {
  return {
    id,
    snippet: {
      title: `Title ${id}`,
      channelId: 'UCchan',
      channelTitle: 'Chan',
      categoryId: '22',
      publishedAt: '2026-09-20T00:00:00Z',
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
    },
    statistics: { viewCount: '1234' },
    contentDetails: { duration: 'PT10M' },
  }
}

describe('fetchVideoDetails', () => {
  it('maps fields including duration, category and publish date', async () => {
    const fetchImpl = vi.fn(async () => json({ items: [raw('a')] }))
    const [v] = await fetchVideoDetails('k', ['a'], fetchImpl as unknown as typeof fetch)
    expect(v).toEqual({
      videoId: 'a',
      title: 'Title a',
      channelId: 'UCchan',
      channelTitle: 'Chan',
      viewCount: 1234,
      thumbnailUrl: 'https://i.ytimg.com/vi/a/mqdefault.jpg',
      durationSec: 600,
      categoryId: '22',
      publishedAt: '2026-09-20T00:00:00Z',
    })
    const url = new URL(String((fetchImpl.mock.calls as unknown[][])[0][0]))
    expect(url.pathname).toMatch(/\/videos$/)
    expect(url.searchParams.get('part')).toBe('snippet,statistics,contentDetails')
    expect(url.searchParams.get('key')).toBe('k')
  })

  it('splits more than 50 ids into several calls', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `v${i}`)
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const requested = (new URL(String(input)).searchParams.get('id') ?? '').split(',')
      return json({ items: requested.map(raw) })
    })
    const result = await fetchVideoDetails('k', ids, fetchImpl as unknown as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(60)
  })

  it('returns [] without calling the API for no ids', async () => {
    const fetchImpl = vi.fn()
    expect(await fetchVideoDetails('k', [], fetchImpl as unknown as typeof fetch)).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws YouTubeApiError with the HTTP status', async () => {
    const fetchImpl = vi.fn(async () => json({ error: {} }, 403))
    await expect(fetchVideoDetails('k', ['a'], fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      name: 'YouTubeApiError',
      status: 403,
    })
    await expect(fetchVideoDetails('k', ['a'], fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(
      YouTubeApiError,
    )
  })
})

describe('byViewsDesc', () => {
  it('sorts by view count, highest first', () => {
    const list = [{ viewCount: 1 }, { viewCount: 3 }, { viewCount: 2 }]
    expect(list.sort(byViewsDesc).map((v) => v.viewCount)).toEqual([3, 2, 1])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/youtube/parseDuration.test.ts src/lib/youtube/parseChannelInput.test.ts src/lib/youtube/api.test.ts`
Expected: FAIL — 세 모듈을 찾을 수 없음

- [ ] **Step 3: 구현**

`src/lib/youtube/parseDuration.ts`:

```ts
const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/** YouTube의 ISO 8601 길이("PT12M3S")를 초로 바꾼다. 해석할 수 없으면 0. */
export function parseDuration(iso: string): number {
  const m = ISO_DURATION.exec(iso)
  if (!m || iso === 'P' || iso.endsWith('T')) return 0
  const [, d, h, min, s] = m.map((part) => Number(part ?? 0))
  return d * 86400 + h * 3600 + min * 60 + s
}
```

`src/lib/youtube/parseChannelInput.ts`:

```ts
export type ChannelQuery = { handle: string } | { channelId: string }

const CHANNEL_ID = /^UC[\w-]{22}$/
const HANDLE = /^[\w.-]{3,30}$/

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
    const handle = decodeURIComponent(first.slice(1))
    return HANDLE.test(handle) ? { handle } : null
  }
  if (first === 'channel' && second && CHANNEL_ID.test(second)) return { channelId: second }
  return null
}
```

`src/lib/youtube/api.ts`:

```ts
import { parseDuration } from './parseDuration'

export const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'

/** 이 길이(초) 이하인 영상은 숏츠로 보고 추천에서 뺀다. */
export const MAX_SHORTS_SEC = 180

export class YouTubeApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'YouTubeApiError'
    this.status = status
  }
}

export type VideoDetail = {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  viewCount: number
  thumbnailUrl: string
  durationSec: number
  categoryId: string
  publishedAt: string
}

type VideosResponse = {
  items?: {
    id: string
    snippet: {
      title: string
      channelId: string
      channelTitle: string
      categoryId?: string
      publishedAt: string
      thumbnails: Record<string, { url: string } | undefined>
    }
    statistics: { viewCount?: string }
    contentDetails: { duration?: string }
  }[]
}

export async function getJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const res = await fetchImpl(url, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text()
    throw new YouTubeApiError(res.status, body.slice(0, 300))
  }
  return (await res.json()) as T
}

/** 영상 상세(제목·조회수·길이·카테고리)를 50개씩 나눠 조회한다. 호출당 1 unit. */
export async function fetchVideoDetails(
  apiKey: string,
  ids: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<VideoDetail[]> {
  const details: VideoDetail[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({
      part: 'snippet,statistics,contentDetails',
      id: ids.slice(i, i + 50).join(','),
      key: apiKey,
    })
    const data = await getJson<VideosResponse>(fetchImpl, `${YOUTUBE_API}/videos?${params}`)
    for (const v of data.items ?? []) {
      details.push({
        videoId: v.id,
        title: v.snippet.title,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        viewCount: Number(v.statistics.viewCount ?? 0),
        thumbnailUrl: v.snippet.thumbnails.medium?.url ?? v.snippet.thumbnails.default?.url ?? '',
        durationSec: parseDuration(v.contentDetails.duration ?? ''),
        categoryId: v.snippet.categoryId ?? '',
        publishedAt: v.snippet.publishedAt,
      })
    }
  }
  return details
}

export const byViewsDesc = (a: { viewCount: number }, b: { viewCount: number }) =>
  b.viewCount - a.viewCount
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/lib/youtube`
Expected: 새 테스트 전부 통과 (기존 `fetchTrends.test.ts`도 그대로 통과)

Run: `npm run typecheck && npm run lint`
Expected: 통과

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube
git commit -m "feat: add YouTube duration, channel input, and video detail helpers"
```

---

### Task 3: 키워드·채널 후보 조회와 채널 조회

**Files:**
- Create: `src/lib/youtube/fakeYouTube.ts`, `src/lib/youtube/fetchKeywordVideos.ts`, `src/lib/youtube/fetchChannelVideos.ts`, `src/lib/youtube/lookupChannel.ts`
- Test: `src/lib/youtube/fetchKeywordVideos.test.ts`, `src/lib/youtube/fetchChannelVideos.test.ts`, `src/lib/youtube/lookupChannel.test.ts`
- Delete: `src/lib/youtube/fetchTrends.ts`, `src/lib/youtube/fetchTrends.test.ts`
- Modify: `src/lib/trends/getTodayTrends.ts` (import만 임시 교체 — Step 5 참고)

**Interfaces:**
- Consumes: `api.ts`의 `YOUTUBE_API`, `MAX_SHORTS_SEC`, `YouTubeApiError`, `getJson`, `fetchVideoDetails`, `byViewsDesc`, `VideoDetail`; `ChannelQuery`
- Produces: `NICHE_CATEGORY_IDS: Set<string>`, `fetchKeywordVideos({ apiKey, keywords, now, fetchImpl? }): Promise<VideoDetail[]>` (필터·정렬 완료)
- Produces: `MAX_PER_CHANNEL = 2`, `fetchChannelVideos({ apiKey, playlistIds, now, fetchImpl? }): Promise<VideoDetail[]>` (필터·정렬·채널당 2개 완료)
- Produces: `ChannelInfo = { channelId: string; handle: string | null; title: string; thumbnailUrl: string; uploadsPlaylistId: string }`, `lookupChannel({ apiKey, query, fetchImpl? }): Promise<ChannelInfo | null>`

- [ ] **Step 1: 테스트용 가짜 YouTube**

`src/lib/youtube/fakeYouTube.ts`:

```ts
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
```

- [ ] **Step 2: 실패하는 테스트**

`src/lib/youtube/fetchKeywordVideos.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { asFetch, callsTo, fakeYouTube, rawVideo } from './fakeYouTube'
import { fetchKeywordVideos } from './fetchKeywordVideos'

const now = new Date('2026-09-29T00:00:00Z')

describe('fetchKeywordVideos', () => {
  it('returns [] without calling the API when there are no keywords', async () => {
    const yt = fakeYouTube({})
    expect(await fetchKeywordVideos({ apiKey: 'k', keywords: [], now, fetchImpl: asFetch(yt) })).toEqual([])
    expect(yt).not.toHaveBeenCalled()
  })

  it('searches each keyword by relevance with the niche parameters', async () => {
    const yt = fakeYouTube({ search: { storytime: ['a'], yapping: ['b'] }, videos: [rawVideo('a'), rawVideo('b')] })
    await fetchKeywordVideos({ apiKey: 'k', keywords: ['storytime', 'yapping'], now, fetchImpl: asFetch(yt) })

    const searches = callsTo(yt, '/search')
    expect(searches.map((u) => u.searchParams.get('q'))).toEqual(['storytime', 'yapping'])
    for (const u of searches) {
      const p = u.searchParams
      expect(p.get('type')).toBe('video')
      expect(p.get('order')).toBe('relevance')
      expect(p.get('maxResults')).toBe('25')
      expect(p.get('relevanceLanguage')).toBe('en')
      expect(p.get('regionCode')).toBe('US')
      expect(p.get('publishedAfter')).toBe('2026-09-22T00:00:00.000Z')
    }
  })

  it('dedupes ids, drops Shorts (<= 180s) and off-niche categories, and sorts by views', async () => {
    const yt = fakeYouTube({
      search: { a: ['long', 'short', 'music'], b: ['long', 'grwm', 'edge'] },
      videos: [
        rawVideo('long', { views: '10', duration: 'PT20M', category: '22' }),
        rawVideo('short', { views: '999', duration: 'PT59S', category: '22' }),
        rawVideo('music', { views: '500', duration: 'PT4M', category: '10' }),
        rawVideo('grwm', { views: '50', duration: 'PT15M', category: '26' }),
        rawVideo('edge', { views: '70', duration: 'PT3M', category: '24' }),
      ],
    })
    const result = await fetchKeywordVideos({ apiKey: 'k', keywords: ['a', 'b'], now, fetchImpl: asFetch(yt) })

    expect(result.map((v) => v.videoId)).toEqual(['grwm', 'long'])
    expect(callsTo(yt, '/videos')).toHaveLength(1)
  })
})
```

`src/lib/youtube/fetchChannelVideos.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { asFetch, callsTo, fakeYouTube, rawVideo } from './fakeYouTube'
import { fetchChannelVideos } from './fetchChannelVideos'

const now = new Date('2026-09-29T00:00:00Z')

describe('fetchChannelVideos', () => {
  it('returns [] without calling the API when there are no channels', async () => {
    const yt = fakeYouTube({})
    expect(await fetchChannelVideos({ apiKey: 'k', playlistIds: [], now, fetchImpl: asFetch(yt) })).toEqual([])
    expect(yt).not.toHaveBeenCalled()
  })

  it('reads 20 recent uploads per channel', async () => {
    const yt = fakeYouTube({ playlists: { UUa: ['a1'] }, videos: [rawVideo('a1')] })
    await fetchChannelVideos({ apiKey: 'k', playlistIds: ['UUa'], now, fetchImpl: asFetch(yt) })
    const [call] = callsTo(yt, '/playlistItems')
    expect(call.searchParams.get('playlistId')).toBe('UUa')
    expect(call.searchParams.get('maxResults')).toBe('20')
    expect(call.searchParams.get('part')).toBe('contentDetails')
  })

  it('keeps last-30-day videos over 180s, sorted by views, at most 2 per channel', async () => {
    const yt = fakeYouTube({
      playlists: { UUa: ['a1', 'a2', 'a3', 'aOld', 'aShort'], UUb: ['b1'] },
      videos: [
        rawVideo('a1', { views: '300', channelId: 'UCa' }),
        rawVideo('a2', { views: '200', channelId: 'UCa' }),
        rawVideo('a3', { views: '100', channelId: 'UCa' }),
        rawVideo('aOld', { views: '9999', channelId: 'UCa', publishedAt: '2026-08-20T00:00:00Z' }),
        rawVideo('aShort', { views: '8888', channelId: 'UCa', duration: 'PT2M' }),
        rawVideo('b1', { views: '150', channelId: 'UCb', category: '10' }),
      ],
    })
    const result = await fetchChannelVideos({ apiKey: 'k', playlistIds: ['UUa', 'UUb'], now, fetchImpl: asFetch(yt) })

    // 카테고리 필터 없음 (b1은 음악 카테고리지만 남는다)
    expect(result.map((v) => v.videoId)).toEqual(['a1', 'a2', 'b1'])
  })

  it('skips a deleted or private channel (404) and keeps the others', async () => {
    const yt = fakeYouTube({
      playlists: { UUgone: 'missing', UUb: ['b1'] },
      videos: [rawVideo('b1', { channelId: 'UCb' })],
    })
    const result = await fetchChannelVideos({ apiKey: 'k', playlistIds: ['UUgone', 'UUb'], now, fetchImpl: asFetch(yt) })
    expect(result.map((v) => v.videoId)).toEqual(['b1'])
  })
})
```

`src/lib/youtube/lookupChannel.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { asFetch, callsTo, fakeYouTube, json, rawChannel } from './fakeYouTube'
import { lookupChannel } from './lookupChannel'

const ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'

describe('lookupChannel', () => {
  const yt = () => fakeYouTube({ channels: [rawChannel(ID, 'Yapper', 'The Yapper')] })

  it('finds a channel by handle', async () => {
    const fetchImpl = yt()
    const info = await lookupChannel({ apiKey: 'k', query: { handle: 'yapper' }, fetchImpl: asFetch(fetchImpl) })
    expect(info).toEqual({
      channelId: ID,
      handle: 'Yapper',
      title: 'The Yapper',
      thumbnailUrl: `https://yt3.ggpht.com/${ID}`,
      uploadsPlaylistId: 'UU_x5XG1OV2P6uZZ5FSM9Ttw',
    })
    const [call] = callsTo(fetchImpl, '/channels')
    expect(call.searchParams.get('forHandle')).toBe('@yapper')
    expect(call.searchParams.get('part')).toBe('snippet,contentDetails')
  })

  it('finds a channel by id', async () => {
    const fetchImpl = yt()
    const info = await lookupChannel({ apiKey: 'k', query: { channelId: ID }, fetchImpl: asFetch(fetchImpl) })
    expect(info?.channelId).toBe(ID)
    expect(callsTo(fetchImpl, '/channels')[0].searchParams.get('id')).toBe(ID)
  })

  it('returns null when nothing matches', async () => {
    const info = await lookupChannel({ apiKey: 'k', query: { handle: 'nobody' }, fetchImpl: asFetch(yt()) })
    expect(info).toBeNull()
  })

  it('propagates API errors', async () => {
    const fetchImpl = vi.fn(async () => json({}, 500))
    await expect(
      lookupChannel({ apiKey: 'k', query: { handle: 'x' }, fetchImpl: asFetch(fetchImpl) }),
    ).rejects.toMatchObject({ name: 'YouTubeApiError', status: 500 })
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- src/lib/youtube`
Expected: FAIL — `fetchKeywordVideos`, `fetchChannelVideos`, `lookupChannel`을 찾을 수 없음

- [ ] **Step 4: 구현**

`src/lib/youtube/fetchKeywordVideos.ts`:

```ts
import { byViewsDesc, fetchVideoDetails, getJson, MAX_SHORTS_SEC, YOUTUBE_API, type VideoDetail } from './api'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** 수다·스토리텔링 니치가 주로 속한 카테고리: People & Blogs, Comedy, Entertainment, Howto & Style */
export const NICHE_CATEGORY_IDS = new Set(['22', '23', '24', '26'])

type SearchResponse = { items?: { id?: { videoId?: string } }[] }

/**
 * 키워드마다 영어권 최근 7일 영상을 관련도 순으로 찾고, 숏츠와 니치 밖 카테고리를 걸러
 * 조회수 순으로 돌려준다. 할당량: search 100 units × 키워드 수 + videos 1 unit/50개.
 */
export async function fetchKeywordVideos({
  apiKey,
  keywords,
  now,
  fetchImpl = fetch,
}: {
  apiKey: string
  keywords: string[]
  now: Date
  fetchImpl?: typeof fetch
}): Promise<VideoDetail[]> {
  if (keywords.length === 0) return []

  const publishedAfter = new Date(now.getTime() - WEEK_MS).toISOString()
  const idLists = await Promise.all(
    keywords.map(async (q) => {
      const params = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        q,
        relevanceLanguage: 'en',
        regionCode: 'US',
        order: 'relevance',
        publishedAfter,
        maxResults: '25',
        key: apiKey,
      })
      const data = await getJson<SearchResponse>(fetchImpl, `${YOUTUBE_API}/search?${params}`)
      return (data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => !!id)
    }),
  )

  const ids = [...new Set(idLists.flat())]
  if (ids.length === 0) return []

  const videos = await fetchVideoDetails(apiKey, ids, fetchImpl)
  return videos
    .filter((v) => v.durationSec > MAX_SHORTS_SEC && NICHE_CATEGORY_IDS.has(v.categoryId))
    .sort(byViewsDesc)
}
```

`src/lib/youtube/fetchChannelVideos.ts`:

```ts
import {
  byViewsDesc,
  fetchVideoDetails,
  getJson,
  MAX_SHORTS_SEC,
  YOUTUBE_API,
  YouTubeApiError,
  type VideoDetail,
} from './api'

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000
/** 한 채널이 추천 자리를 독차지하지 않도록 채널당 이 개수까지만 고른다. */
export const MAX_PER_CHANNEL = 2

type PlaylistItemsResponse = { items?: { contentDetails?: { videoId?: string } }[] }

/**
 * 채널 업로드 목록에서 최근 영상을 읽어, 최근 30일·3분 초과 영상을 조회수 순으로
 * 채널당 최대 2개씩 돌려준다. 할당량: 채널당 1 unit + videos 1 unit/50개.
 */
export async function fetchChannelVideos({
  apiKey,
  playlistIds,
  now,
  fetchImpl = fetch,
}: {
  apiKey: string
  playlistIds: string[]
  now: Date
  fetchImpl?: typeof fetch
}): Promise<VideoDetail[]> {
  if (playlistIds.length === 0) return []

  const idLists = await Promise.all(
    playlistIds.map(async (playlistId) => {
      const params = new URLSearchParams({ part: 'contentDetails', playlistId, maxResults: '20', key: apiKey })
      try {
        const data = await getJson<PlaylistItemsResponse>(fetchImpl, `${YOUTUBE_API}/playlistItems?${params}`)
        return (data.items ?? []).map((i) => i.contentDetails?.videoId).filter((id): id is string => !!id)
      } catch (err) {
        // 삭제되거나 비공개가 된 채널은 건너뛴다. 그 밖의 오류는 전체 실패로 올린다.
        if (err instanceof YouTubeApiError && err.status === 404) return []
        throw err
      }
    }),
  )

  const ids = [...new Set(idLists.flat())]
  if (ids.length === 0) return []

  const since = now.getTime() - WINDOW_MS
  const videos = (await fetchVideoDetails(apiKey, ids, fetchImpl))
    .filter((v) => v.durationSec > MAX_SHORTS_SEC && Date.parse(v.publishedAt) >= since)
    .sort(byViewsDesc)

  const perChannel = new Map<string, number>()
  return videos.filter((v) => {
    const count = perChannel.get(v.channelId) ?? 0
    if (count >= MAX_PER_CHANNEL) return false
    perChannel.set(v.channelId, count + 1)
    return true
  })
}
```

`src/lib/youtube/lookupChannel.ts`:

```ts
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
```

- [ ] **Step 5: 옛 fetchTrends 제거**

```bash
git rm src/lib/youtube/fetchTrends.ts src/lib/youtube/fetchTrends.test.ts
```

`src/lib/trends/getTodayTrends.ts`는 아직 `fetchTrends`를 쓴다. Task 4에서 전체를 교체하므로, 이 태스크에서는 빌드가 깨지지 않게 import와 호출 한 줄만 바꾼다:

- `import { fetchTrends } from '@/lib/youtube/fetchTrends'` → `import { fetchKeywordVideos } from '@/lib/youtube/fetchKeywordVideos'`
- `const videos = await fetchTrends({ apiKey, keywords: keywords.slice(0, MAX_KEYWORDS), now: new Date() })` → `const videos = (await fetchKeywordVideos({ apiKey, keywords: keywords.slice(0, MAX_KEYWORDS), now: new Date() })).slice(0, 8)`

그리고 upsert하는 객체에 `source: 'keyword' as const,`를 추가한다 (`thumbnail_url` 다음 줄).

- [ ] **Step 6: 통과 확인**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 전부 통과

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/youtube src/lib/trends/getTodayTrends.ts
git commit -m "feat: fetch niche keyword videos and benchmark channel uploads"
```

---

### Task 4: 4+4 합치기 · getTodayTrends · 위젯 두 묶음

**Files:**
- Create: `src/lib/trends/pickTrends.ts`
- Test: `src/lib/trends/pickTrends.test.ts`
- Modify: `src/lib/trends/getTodayTrends.ts` (전체 교체), `src/features/trends/TrendsWidget.tsx` (전체 교체)

**Interfaces:**
- Consumes: `VideoDetail`, `fetchKeywordVideos`, `fetchChannelVideos`, `TrendSource`, `TrendTopic`, `requireUser`, `seoulDateString`
- Produces: `PickedTrend = VideoDetail & { source: TrendSource }`, `pickTrends(channel: VideoDetail[], keyword: VideoDetail[], perSource?: number, total?: number): PickedTrend[]`
- Produces: `TrendsResult = { status: 'ok'; topics: TrendTopic[] } | { status: 'no-sources' } | { status: 'failed'; fallback: TrendTopic[]; fetchedOn: string | null }` (`'no-keywords'` → `'no-sources'`)

- [ ] **Step 1: 실패하는 테스트**

`src/lib/trends/pickTrends.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { VideoDetail } from '@/lib/youtube/api'
import { pickTrends } from './pickTrends'

const v = (id: string): VideoDetail => ({
  videoId: id,
  title: id,
  channelId: 'UC',
  channelTitle: 'C',
  viewCount: 0,
  thumbnailUrl: '',
  durationSec: 600,
  categoryId: '22',
  publishedAt: '2026-09-25T00:00:00Z',
})
const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => v(`${prefix}${i}`))
const ids = (list: { videoId: string; source: string }[]) => list.map((x) => `${x.source[0]}:${x.videoId}`)

describe('pickTrends', () => {
  it('takes 4 from each source in order', () => {
    const result = pickTrends(many('c', 6), many('k', 6))
    expect(ids(result)).toEqual(['c:c0', 'c:c1', 'c:c2', 'c:c3', 'k:k0', 'k:k1', 'k:k2', 'k:k3'])
  })

  it('fills from keywords when channels are short', () => {
    const result = pickTrends(many('c', 1), many('k', 10))
    expect(ids(result)).toEqual(['c:c0', 'k:k0', 'k:k1', 'k:k2', 'k:k3', 'k:k4', 'k:k5', 'k:k6'])
  })

  it('fills from channels when keywords are short', () => {
    const result = pickTrends(many('c', 10), many('k', 2))
    expect(ids(result)).toEqual(['c:c0', 'c:c1', 'c:c2', 'c:c3', 'c:c4', 'c:c5', 'k:k0', 'k:k1'])
  })

  it('returns what exists when both are short', () => {
    expect(ids(pickTrends(many('c', 2), many('k', 1)))).toEqual(['c:c0', 'c:c1', 'k:k0'])
    expect(pickTrends([], [])).toEqual([])
  })

  it('keeps a video found by both only in the channel group', () => {
    const result = pickTrends([v('same'), v('c1')], [v('same'), v('k1')])
    expect(ids(result)).toEqual(['c:same', 'c:c1', 'k:k1'])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/trends`
Expected: FAIL — `./pickTrends`를 찾을 수 없음

- [ ] **Step 3: pickTrends 구현**

`src/lib/trends/pickTrends.ts`:

```ts
import type { TrendSource } from '@/lib/types'
import type { VideoDetail } from '@/lib/youtube/api'

export type PickedTrend = VideoDetail & { source: TrendSource }

/**
 * 채널 후보와 키워드 후보(각각 이미 정렬됨)에서 perSource개씩 고르고,
 * 한쪽이 모자라면 다른 쪽으로 채워 최대 total개를 돌려준다.
 * 같은 영상은 채널 쪽에만 둔다.
 */
export function pickTrends(
  channel: VideoDetail[],
  keyword: VideoDetail[],
  perSource = 4,
  total = 8,
): PickedTrend[] {
  const channelIds = new Set(channel.map((x) => x.videoId))
  const keywordOnly = keyword.filter((x) => !channelIds.has(x.videoId))

  let fromChannel = Math.min(perSource, channel.length)
  let fromKeyword = Math.min(perSource, keywordOnly.length)
  const spare = total - fromChannel - fromKeyword
  if (spare > 0) {
    const extraChannel = Math.min(spare, channel.length - fromChannel)
    fromChannel += extraChannel
    fromKeyword = Math.min(keywordOnly.length, fromKeyword + spare - extraChannel)
  }

  return [
    ...channel.slice(0, fromChannel).map((x) => ({ ...x, source: 'channel' as const })),
    ...keywordOnly.slice(0, fromKeyword).map((x) => ({ ...x, source: 'keyword' as const })),
  ]
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/lib/trends`
Expected: 5 passed

- [ ] **Step 5: getTodayTrends 전체 교체**

`src/lib/trends/getTodayTrends.ts`:

```ts
import { requireUser } from '@/lib/auth/requireUser'
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import type { TrendTopic } from '@/lib/types'
import { fetchChannelVideos } from '@/lib/youtube/fetchChannelVideos'
import { fetchKeywordVideos } from '@/lib/youtube/fetchKeywordVideos'
import { pickTrends } from './pickTrends'

export type TrendsResult =
  | { status: 'ok'; topics: TrendTopic[] }
  | { status: 'no-sources' }
  | { status: 'failed'; fallback: TrendTopic[]; fetchedOn: string | null }

/** YouTube 할당량을 아끼기 위해 한 번의 조회에는 키워드를 최대 이 개수만큼만 쓴다. */
const MAX_KEYWORDS = 5

/**
 * 오늘(한국 시간) 저장된 트렌드가 있으면 그대로, 없으면 벤치마킹 채널과 키워드로
 * YouTube에서 가져와 저장한다. 실패하면 아무것도 저장하지 않고 가장 최근 날짜의 트렌드를 돌려준다.
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
      .order('view_count', { ascending: false })

  /** 조회 자체가 실패했을 때 쓰는 폴백 — 가장 최근 날짜의 트렌드를 돌려준다. */
  const fallback = async (): Promise<TrendsResult> => {
    const { data: latest } = await supabase
      .from('trend_topics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('fetched_on', { ascending: false })
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
    supabase.from('trend_keywords').select('keyword').eq('workspace_id', workspaceId).order('created_at'),
    supabase
      .from('benchmark_channels')
      .select('uploads_playlist_id')
      .eq('workspace_id', workspaceId)
      .order('created_at'),
  ])
  if (keywordRes.error || channelRes.error) return fallback()
  const keywords = (keywordRes.data ?? []).map((r) => r.keyword as string).slice(0, MAX_KEYWORDS)
  const playlistIds = (channelRes.data ?? []).map((r) => r.uploads_playlist_id as string)
  if (keywords.length === 0 && playlistIds.length === 0) return { status: 'no-sources' }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

    const now = new Date()
    const [channelVideos, keywordVideos] = await Promise.all([
      fetchChannelVideos({ apiKey, playlistIds, now }),
      fetchKeywordVideos({ apiKey, keywords, now }),
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
        })),
        // 탭 두 개가 동시에 갱신해도 중복 저장되지 않는다.
        { onConflict: 'workspace_id,fetched_on,video_id', ignoreDuplicates: true },
      )
      if (error) throw new Error(error.message)
    }

    const saved = await todays()
    return { status: 'ok', topics: (saved.data ?? []) as TrendTopic[] }
  } catch (err) {
    console.error('[trends] refresh failed:', err)
    return fallback()
  }
}
```

- [ ] **Step 6: 위젯 전체 교체**

`src/features/trends/TrendsWidget.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { WidgetCard } from '@/components/WidgetCard'
import { ideasData } from '@/features/ideas/data'
import { newId } from '@/lib/id'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { TrendsResult } from '@/lib/trends/getTodayTrends'
import type { PinnedIdea, TrendTopic } from '@/lib/types'
import { videoUrl } from '@/lib/youtube/videoUrl'

export function TrendsWidget({
  result,
  pinnedUrls,
}: {
  result: TrendsResult
  pinnedUrls: string[]
}) {
  const t = useTranslations('trends')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const [pinned, setPinned] = useState(() => new Set(pinnedUrls))
  const [pinFailed, setPinFailed] = useState(false)

  async function pin(topic: TrendTopic) {
    const url = videoUrl(topic.video_id)
    setPinned((prev) => new Set(prev).add(url))
    setPinFailed(false)
    const row: PinnedIdea = {
      id: newId(),
      workspace_id: workspaceId,
      title: topic.title,
      note: topic.channel_title,
      source_url: url,
      thumbnail_url: topic.thumbnail_url || null,
      created_at: new Date().toISOString(),
    }
    // 고정된 아이디어 위젯에는 Realtime INSERT 이벤트로 나타난다.
    const { error } = await ideasData.insert(row)
    if (error) {
      setPinned((prev) => {
        const next = new Set(prev)
        next.delete(url)
        return next
      })
      setPinFailed(true)
    }
  }

  if (result.status === 'no-sources') {
    return (
      <WidgetCard title={t('title')}>
        <p className="text-sm text-gray-600">
          {t('noSources')}{' '}
          <Link href="/youtube/settings" className="underline">
            {t('goToSettings')}
          </Link>
        </p>
      </WidgetCard>
    )
  }

  const topics = result.status === 'ok' ? result.topics : result.fallback
  const groups = [
    { key: 'channel', title: t('fromChannels'), items: topics.filter((x) => x.source === 'channel') },
    { key: 'keyword', title: t('fromKeywords'), items: topics.filter((x) => x.source !== 'channel') },
  ].filter((g) => g.items.length > 0)

  function renderTopic(topic: TrendTopic) {
    const url = videoUrl(topic.video_id)
    const isPinned = pinned.has(url)
    return (
      <li key={topic.id} className="flex gap-2">
        {topic.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={topic.thumbnail_url} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <a href={url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-medium hover:underline">
            {topic.title}
          </a>
          <p className="text-xs text-gray-600">
            {topic.channel_title} · {t('views', { count: topic.view_count })}
          </p>
          <button
            type="button"
            disabled={isPinned}
            onClick={() => void pin(topic)}
            className="mt-1 text-xs underline disabled:text-gray-400 disabled:no-underline"
          >
            {isPinned ? t('pinned') : t('pin')}
          </button>
        </div>
      </li>
    )
  }

  return (
    <WidgetCard title={t('title')} error={pinFailed ? tc('saveFailed') : null}>
      {result.status === 'failed' && (
        <p role="status" className="mb-2 text-sm text-amber-700">
          {t('failed')} {result.fetchedOn && t('showingFrom', { date: result.fetchedOn })}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.key}>
              <h4 className="mb-2 text-sm font-medium text-gray-700">{group.title}</h4>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{group.items.map(renderTopic)}</ul>
            </section>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
```

- [ ] **Step 7: 검증**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 전부 통과

- [ ] **Step 8: Commit**

```bash
git add src/lib/trends src/features/trends/TrendsWidget.tsx
git commit -m "feat: combine channel and keyword trends into two groups"
```

---

### Task 5: 설정 — 벤치마킹 채널 섹션 · 다시 가져오기 분리

**Files:**
- Create: `src/features/trends/channelActions.ts`, `src/features/trends/channelData.ts`, `src/features/trends/ChannelSettings.tsx`, `src/features/trends/RefetchTrends.tsx`
- Modify: `src/features/trends/KeywordSettings.tsx`, `src/features/trends/actions.ts` (주석만), `src/app/(app)/[platform]/settings/page.tsx` (전체 교체), `README.md` (할당량 문장)

**Interfaces:**
- Consumes: `parseChannelInput`, `lookupChannel`, `ChannelInfo`, `requireUser`, `createClient` (server), `tableData`, `useLiveList`, `useWorkspaceId`, `refetchTodayTrends`, `BenchmarkChannel`
- Produces: `AddChannelError = 'invalid' | 'limit' | 'notFound' | 'duplicate' | 'failed'`, `addBenchmarkChannel(workspaceId: string, input: string): Promise<{ ok: true; row: BenchmarkChannel } | { error: AddChannelError }>`
- Produces: `<ChannelSettings initial={BenchmarkChannel[]} />`, `<RefetchTrends />`, `channelsData`

- [ ] **Step 1: Server Action과 데이터 헬퍼**

`src/features/trends/channelData.ts`:

```ts
import { tableData } from '@/lib/tableData'
import type { BenchmarkChannel } from '@/lib/types'

export const channelsData = tableData<BenchmarkChannel>('benchmark_channels')
```

`src/features/trends/channelActions.ts`:

```ts
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
```

- [ ] **Step 2: 채널 설정 컴포넌트**

`src/features/trends/ChannelSettings.tsx`:

```tsx
'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { BenchmarkChannel } from '@/lib/types'
import { addBenchmarkChannel, type AddChannelError } from './channelActions'
import { channelsData } from './channelData'

const byCreated = (a: BenchmarkChannel, b: BenchmarkChannel) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

export function ChannelSettings({ initial }: { initial: BenchmarkChannel[] }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('benchmark_channels', initial, byCreated)
  const [input, setInput] = useState('')
  const [addError, setAddError] = useState<AddChannelError | null>(null)
  const [adding, startAdd] = useTransition()

  function add(e: FormEvent) {
    e.preventDefault()
    const value = input.trim()
    if (!value) return
    setAddError(null)
    startAdd(async () => {
      const result = await addBenchmarkChannel(workspaceId, value)
      if ('error' in result) {
        setAddError(result.error)
        return
      }
      setInput('')
      // 서버에서 이미 저장됐다 — 화면에만 바로 반영한다. 뒤이어 오는 Realtime 이벤트는 같은 id라 중복되지 않는다.
      void mutate({ type: 'INSERT', row: result.row }, async () => ({ error: null }))
    })
  }

  const message = addError ? t(`channelErrors.${addError}`) : error ? tc('saveFailed') : null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">{t('channelsHelp')}</p>

      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          aria-label={t('channelLabel')}
          placeholder={t('channelLabel')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded bg-gray-900 px-3 py-1 text-white disabled:opacity-50"
        >
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('channelsEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 text-sm">
              {row.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.thumbnail_url} alt="" className="h-6 w-6 rounded-full" />
              )}
              <span className="font-medium">{row.title}</span>
              {row.handle && <span className="text-gray-500">@{row.handle}</span>}
              <button
                type="button"
                aria-label={`${tc('delete')} ${row.title}`}
                onClick={() =>
                  void mutate({ type: 'DELETE', id: row.id }, () => channelsData.remove(row.id))
                }
                className="ml-auto text-gray-400 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 다시 가져오기를 별도 컴포넌트로 분리**

`src/features/trends/RefetchTrends.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { refetchTodayTrends } from './actions'

export function RefetchTrends() {
  const t = useTranslations('settings')
  const workspaceId = useWorkspaceId()
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  const [refetching, startRefetch] = useTransition()

  function refetch() {
    setState('idle')
    startRefetch(async () => {
      const result = await refetchTodayTrends(workspaceId)
      setState('ok' in result ? 'done' : 'failed')
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={refetch}
        disabled={refetching}
        className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
      >
        {t('refetch')}
      </button>
      <span aria-live="polite" className="text-sm">
        {state === 'done' && t('refetchDone')}
        {state === 'failed' && <span className="text-red-600">{t('refetchFailed')}</span>}
      </span>
    </div>
  )
}
```

`src/features/trends/KeywordSettings.tsx`에서 다시 가져오기 관련 코드를 제거한다:
- import 줄 `import { useState, useTransition, type FormEvent } from 'react'` → `import { useState, type FormEvent } from 'react'`
- `import { refetchTodayTrends } from './actions'` 줄 삭제
- `const [refetchState, setRefetchState] = …` 와 `const [refetching, startRefetch] = useTransition()` 두 줄 삭제
- `function refetch() { … }` 함수 전체 삭제
- JSX 맨 아래의 `<div className="flex items-center gap-3"> … {t('refetch')} … </div>` 블록 전체 삭제

`src/features/trends/actions.ts`의 주석 `/** 오늘 저장된 트렌드를 지우고 현재 키워드로 다시 가져온다. */` → `/** 오늘 저장된 트렌드를 지우고 현재 채널·키워드로 다시 가져온다. */`

- [ ] **Step 4: 설정 페이지 전체 교체**

`src/app/(app)/[platform]/settings/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WidgetCard } from '@/components/WidgetCard'
import { LanguageToggle } from '@/features/settings/LanguageToggle'
import { WorkspaceNameForm } from '@/features/settings/WorkspaceNameForm'
import { ChannelSettings } from '@/features/trends/ChannelSettings'
import { KeywordSettings } from '@/features/trends/KeywordSettings'
import { RefetchTrends } from '@/features/trends/RefetchTrends'
import { WorkspaceRealtime } from '@/lib/realtime/WorkspaceRealtime'
import { createClient } from '@/lib/supabase/server'
import { isPlatform, type BenchmarkChannel, type TrendKeyword } from '@/lib/types'
import { getWorkspace } from '@/lib/workspace'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ platform: string }>
}) {
  const { platform } = await params
  if (!isPlatform(platform)) notFound()
  const workspace = await getWorkspace(platform)
  if (!workspace) notFound()
  const t = await getTranslations('settings')

  let keywords: TrendKeyword[] = []
  let channels: BenchmarkChannel[] = []
  if (platform === 'youtube') {
    const supabase = await createClient()
    const [keywordRes, channelRes] = await Promise.all([
      supabase.from('trend_keywords').select('*').eq('workspace_id', workspace.id),
      supabase.from('benchmark_channels').select('*').eq('workspace_id', workspace.id),
    ])
    keywords = (keywordRes.data ?? []) as TrendKeyword[]
    channels = (channelRes.data ?? []) as BenchmarkChannel[]
  }

  return (
    <WorkspaceRealtime key={workspace.id} workspaceId={workspace.id}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <WidgetCard title={t('account')}>
          <LanguageToggle />
        </WidgetCard>
        <WidgetCard title={t('workspace')}>
          <WorkspaceNameForm workspaceId={workspace.id} name={workspace.name} />
        </WidgetCard>
        {platform === 'youtube' && (
          <>
            <WidgetCard title={t('benchmarkChannels')}>
              <ChannelSettings initial={channels} />
            </WidgetCard>
            <WidgetCard title={t('trendKeywords')}>
              <KeywordSettings initial={keywords} />
            </WidgetCard>
            <WidgetCard title={t('refetchTitle')}>
              <RefetchTrends />
            </WidgetCard>
          </>
        )}
      </div>
    </WorkspaceRealtime>
  )
}
```

- [ ] **Step 5: README 할당량 문장**

`README.md`에서 YouTube 할당량을 설명하는 문장(`grep -n "units" README.md`로 찾는다)을 다음으로 바꾼다:

```markdown
하루 무료 할당량은 10,000 units이고, 이 앱은 사용자당 하루 약 520 units를 쓴다 (키워드 최대 5개 × 100 + 벤치마킹 채널 최대 10개 × 1 + 영상 상세 조회). 결제 정보는 필요 없다.
```

그리고 "## 1. Supabase 설정"의 SQL 실행 단계(`0001_init.sql` 실행 줄) 바로 다음에 한 줄을 추가한다:

```markdown
   이어서 `supabase/migrations/0002_trend_sources.sql`도 실행한다.
```

- [ ] **Step 6: 검증**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 전부 통과

- [ ] **Step 7: Commit**

```bash
git add -A src/features/trends "src/app/(app)/[platform]/settings/page.tsx" README.md
git commit -m "feat: manage benchmark channels in settings"
```

---

### Task 6: 브라우저 검증 (컨트롤러)

사용자가 `0002_trend_sources.sql`을 실행한 뒤, 컨트롤러가 개발 서버와 내장 브라우저로 확인한다.

- [ ] `/youtube/settings`: 섹션 순서가 벤치마킹 채널 → 트렌드 검색 키워드 → 오늘 트렌드
- [ ] 채널 추가: `@핸들`, `youtube.com/@핸들`, `https://www.youtube.com/channel/UC…` 각각 성공, 목록에 썸네일·채널명·@핸들
- [ ] 같은 채널 재등록 → "이미 등록된 채널이에요", 잘못된 입력 → 형식 안내, 없는 핸들 → "채널을 찾지 못했어요"
- [ ] 채널 삭제가 두 번째 탭에 실시간 반영
- [ ] "오늘 트렌드 다시 가져오기" → 대시보드 트렌드 위젯이 "📺 벤치마킹 채널" / "🔍 키워드 추천" 두 묶음, 3분 이하 영상 없음, 채널 묶음에서 한 채널 최대 2개
- [ ] 채널·키워드 모두 삭제 후 다시 가져오기 → "추천에 쓸 벤치마킹 채널이나 키워드가 없어요" + 설정 링크
- [ ] pin → 고정된 아이디어에 추가
- [ ] English 전환 시 새 문구 모두 영어
- [ ] 서버 에러 로그 없음
