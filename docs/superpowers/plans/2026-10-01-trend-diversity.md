# 트렌드 추천 다양성 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 영상·같은 주제가 반복 추천되지 않도록 점수 중복 제거, 주제 다양성, 최근 추천 제외, 오늘 키워드 가산점을 넣는다.

**Architecture:** 순수 함수(`scoreVideo`, `pickTrends`, 새 `excludeVideos`)에 로직을 두고 단위 테스트한다. `fetchChannelVideos`는 `boost` 인자로 정렬만 바꾼다. `getTodayTrends`/`refetchTodayTrends`는 Supabase에서 최근 기록을 읽어 이 함수들에 연결만 한다.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Vitest

**Spec:** `docs/superpowers/specs/2026-10-01-trend-diversity-design.md`

## Global Constraints

- YouTube API 호출 수를 늘리지 않는다 (1회 ≈ 430 units 유지).
- DB 마이그레이션 없음, 화면 UI 변경 없음.
- 저장·표시되는 `relevance`는 가산점 없는 원래 점수.
- 각 태스크 후 `npx vitest run`, 마지막에 `npm run typecheck`, `npm run lint`, `npm run build` 통과.

---

### Task 1: 포함 관계 키워드는 가장 긴 것만 센다 (①)

**Files:**
- Modify: `src/lib/trends/scoreVideo.ts` (`scoreVideo`)
- Test: `src/lib/trends/scoreVideo.test.ts`

**Interfaces:** 시그니처 변화 없음 — `scoreVideo(video: Scorable, pool: string[]): { relevance: number; matched: string[] }`

- [ ] **Step 1: 실패하는 테스트 추가** (`describe('scoreVideo')` 안)

```ts
  it('counts only the longest of nested keywords', () => {
    expect(
      scoreVideo(video('Living Alone Diaries | cozy week'), ['alone', 'living alone', 'living alone diaries']),
    ).toEqual({ relevance: 2, matched: ['living alone diaries'] })
  })

  it('keeps a title match even if a longer keyword only matches the description', () => {
    expect(
      scoreVideo(video('living alone at 25', [], 'living alone diaries ep 3'), ['living alone', 'living alone diaries']),
    ).toEqual({ relevance: 3, matched: ['living alone', 'living alone diaries'] })
  })

  it('drops a nested keyword that also matched the title on its own', () => {
    expect(scoreVideo(video('living alone diaries', [], 'alone again'), ['alone', 'living alone diaries'])).toEqual({
      relevance: 2,
      matched: ['living alone diaries'],
    })
  })

  it('counts keywords that only differ in case once', () => {
    expect(scoreVideo(video('mindset reset'), ['mindset', 'Mindset'])).toEqual({ relevance: 2, matched: ['mindset'] })
  })

  it('still counts keywords that are not nested', () => {
    expect(scoreVideo(video('living alone but not lonely'), ['living alone', 'lonely'])).toEqual({
      relevance: 4,
      matched: ['living alone', 'lonely'],
    })
  })
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/trends/scoreVideo.test.ts` → 새 테스트 1·3·4 FAIL (2·5는 기존 동작 고정용)

- [ ] **Step 3: 구현** — `scoreVideo`를 다음으로 교체 (doc 주석 포함)

```ts
/**
 * 풀 키워드가 제목(2점)·태그/설명(1점)에 몇 개 들어 있는지 센다. matched는 제목 매칭이 먼저.
 * 다른 매칭 키워드 안에 들어 있는 키워드(alone ⊂ living alone)는 빼서 같은 뜻을 두 번 세지 않는다.
 * 단, 제목 매칭은 태그/설명에서만 맞은 더 긴 키워드 때문에 빠지지 않는다.
 */
export function scoreVideo(video: Scorable, pool: string[]): { relevance: number; matched: string[] } {
  const title = video.title.toLowerCase()
  const rest = [...video.tags, video.description].join('\n').toLowerCase()
  const seen = new Set<string>()
  const hits: { keyword: string; phrase: string; inTitle: boolean }[] = []
  for (const keyword of pool) {
    const phrase = keyword.trim().toLowerCase()
    if (!phrase || seen.has(phrase)) continue
    seen.add(phrase)
    if (containsPhrase(title, phrase)) hits.push({ keyword, phrase, inTitle: true })
    else if (containsPhrase(rest, phrase)) hits.push({ keyword, phrase, inTitle: false })
  }
  const kept = hits.filter(
    (h) => !hits.some((o) => o !== h && (o.inTitle || !h.inTitle) && containsPhrase(o.phrase, h.phrase)),
  )
  const inTitle = kept.filter((h) => h.inTitle).map((h) => h.keyword)
  const inRest = kept.filter((h) => !h.inTitle).map((h) => h.keyword)
  return {
    relevance: inTitle.length * TITLE_POINTS + inRest.length * OTHER_POINTS,
    matched: [...inTitle, ...inRest],
  }
}
```

- [ ] **Step 4: 통과 확인** — `npx vitest run` → 전부 PASS

- [ ] **Step 5: 커밋** — `git commit -am "feat(trends): count only the longest of nested keywords"`

---

### Task 2: 벤치마킹 정렬에 오늘 키워드 가산점 (④)

**Files:**
- Modify: `src/lib/youtube/fetchChannelVideos.ts`
- Test: `src/lib/youtube/fetchChannelVideos.test.ts`

**Interfaces:**
- Produces: `fetchChannelVideos({ ..., boost?: string[] })`, `export const BOOST_POINTS = 2`

- [ ] **Step 1: 실패하는 테스트 추가** (기존 `describe` 안, 파일 상단의 `fakeYouTube`/`rawVideo`/`asFetch`/`now` 재사용)

```ts
  it('ranks videos matching boosted keywords first without changing relevance', async () => {
    const yt = fakeYouTube({
      playlists: { UUa: ['a1'], UUb: ['b1'] },
      videos: [
        rawVideo('a1', { views: '100', channelId: 'UCa', title: 'glow up diaries' }),
        rawVideo('b1', { views: '10', channelId: 'UCb', title: 'storytelling time' }),
      ],
    })
    const result = await fetchChannelVideos({
      apiKey: 'k',
      playlistIds: ['UUa', 'UUb'],
      pool: ['glow up', 'mindset', 'storytelling'],
      boost: ['storytelling'],
      now,
      fetchImpl: asFetch(yt),
    })
    expect(result.map((v) => [v.videoId, v.relevance])).toEqual([
      ['b1', 2],
      ['a1', 2],
    ])
  })
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/youtube/fetchChannelVideos.test.ts` → FAIL (동점이라 조회수 많은 a1이 먼저)

- [ ] **Step 3: 구현**

import 줄을 `import { scoreAll, type ScoredVideo } from '@/lib/trends/scoreVideo'`로 바꾸고, `MAX_PER_CHANNEL` 아래에 추가:

```ts
/** 오늘 로테이션 키워드와 맞으면 정렬할 때 키워드당 더하는 점수 (저장되는 relevance에는 넣지 않는다). */
export const BOOST_POINTS = 2
```

인자에 `boost = [],` / 타입에 `boost?: string[]` 추가, doc 주석 끝에 "오늘 키워드(`boost`)와 맞는 영상은 정렬에서 키워드당 2점을 더 받는다." 추가. 정렬 부분 교체:

```ts
  const boosted = new Set(boost.map((k) => k.trim().toLowerCase()))
  const sortScore = (v: ScoredVideo) =>
    v.relevance + BOOST_POINTS * v.matched.filter((k) => boosted.has(k.trim().toLowerCase())).length
  const videos = scoreAll(recent, pool).sort((a, b) => sortScore(b) - sortScore(a) || b.viewCount - a.viewCount)
```

- [ ] **Step 4: 통과 확인** — `npx vitest run` → PASS

- [ ] **Step 5: 커밋** — `git commit -am "feat(trends): boost today's rotation keywords in benchmark ranking"`

---

### Task 3: 주제 다양성 선택 (②)

**Files:**
- Modify: `src/lib/trends/pickTrends.ts`
- Test: `src/lib/trends/pickTrends.test.ts`

**Interfaces:**
- Produces: `diverseOrder<T extends { matched?: string[] }>(list: T[], groupOf: (keyword: string) => string): T[]`
- Produces: `pickTrends(channel, keyword, options?: { groupOf?: (keyword: string) => string; perSource?: number; total?: number })`

- [ ] **Step 1: 실패하는 테스트 추가** — import에 `diverseOrder` 추가, 파일 끝에:

```ts
const m = (id: string, matched: string[]) => ({ ...v(id), matched })
const groups: Record<string, string> = { 'living alone': 'solo', alone: 'solo', storytelling: 'story', 'glow up': 'growth' }
const groupOf = (k: string) => groups[k] ?? k

describe('diverseOrder', () => {
  it('moves videos whose top group already appeared to the back', () => {
    const list = [m('a', ['living alone']), m('b', ['alone']), m('c', ['storytelling']), m('d', ['glow up'])]
    expect(diverseOrder(list, groupOf).map((x) => x.videoId)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('puts videos without matches after the varied ones, keeping order', () => {
    const list = [m('a', ['living alone']), m('z', []), m('b', ['alone']), m('c', ['storytelling'])]
    expect(diverseOrder(list, groupOf).map((x) => x.videoId)).toEqual(['a', 'c', 'z', 'b'])
  })
})

describe('pickTrends with groupOf', () => {
  it('prefers different groups and fills with the rest when short', () => {
    const channel = [m('c0', ['living alone']), m('c1', ['alone']), m('c2', ['living alone']), m('c3', ['storytelling'])]
    const result = pickTrends(channel, [], { groupOf, perSource: 2, total: 3 })
    expect(ids(result)).toEqual(['c:c0', 'c:c3', 'c:c1'])
  })
})
```

기존 테스트의 호출은 그대로 (옵션 없이 기존 동작).

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/trends/pickTrends.test.ts` → FAIL (`diverseOrder` 없음)

- [ ] **Step 3: 구현** — `pickTrends.ts`에 추가하고 `pickTrends` 시그니처 변경

```ts
/**
 * 앞에서부터 아직 나오지 않은 대표 그룹(matched[0]의 그룹)의 영상을 먼저 두고,
 * 이미 나온 그룹과 매칭이 없는 영상은 원래 순서대로 뒤에 붙인다.
 */
export function diverseOrder<T extends { matched?: string[] }>(list: T[], groupOf: (keyword: string) => string): T[] {
  const seen = new Set<string>()
  const first: T[] = []
  const later: T[] = []
  for (const x of list) {
    const top = x.matched?.[0]
    const group = top === undefined ? undefined : groupOf(top)
    if (group === undefined || seen.has(group)) later.push(x)
    else {
      seen.add(group)
      first.push(x)
    }
  }
  return [...first, ...later]
}
```

`pickTrends` 시그니처와 앞부분:

```ts
export function pickTrends<T extends VideoDetail & { matched?: string[] }>(
  channelList: T[],
  keywordList: T[],
  { groupOf, perSource = 4, total = 8 }: { groupOf?: (keyword: string) => string; perSource?: number; total?: number } = {},
): PickedTrend<T>[] {
  const channel = groupOf ? diverseOrder(channelList, groupOf) : channelList
  const keyword = groupOf ? diverseOrder(keywordList, groupOf) : keywordList
```

(나머지 본문은 그대로.) doc 주석에 "`groupOf`가 있으면 각 목록을 먼저 `diverseOrder`로 재배열한다." 한 줄 추가.

- [ ] **Step 4: 통과 확인** — `npx vitest run` → PASS

- [ ] **Step 5: 커밋** — `git commit -am "feat(trends): prefer varied keyword groups when picking trends"`

---

### Task 4: 최근 추천 제외 + 연결 (③, ②·④ 연결)

**Files:**
- Create: `src/lib/trends/excludeVideos.ts`, `src/lib/trends/excludeVideos.test.ts`
- Modify: `src/lib/trends/getTodayTrends.ts`, `src/features/trends/actions.ts`

**Interfaces:**
- Consumes: `fetchChannelVideos({ boost })` (Task 2), `pickTrends(c, k, { groupOf })` (Task 3)
- Produces: `excludeVideos<T extends { videoId: string }>(channel: T[], keyword: T[], exclude: Iterable<string>): { channel: T[]; keyword: T[] }`, `getTodayTrends(workspaceId, { exclude?: string[] })`

- [ ] **Step 1: 실패하는 테스트** — `src/lib/trends/excludeVideos.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { excludeVideos } from './excludeVideos'

const v = (videoId: string) => ({ videoId })
const ids = (r: { channel: { videoId: string }[]; keyword: { videoId: string }[] }) => [
  r.channel.map((x) => x.videoId),
  r.keyword.map((x) => x.videoId),
]

describe('excludeVideos', () => {
  it('removes excluded videos from both lists', () => {
    expect(ids(excludeVideos([v('a'), v('b')], [v('c'), v('a')], ['a']))).toEqual([['b'], ['c']])
  })

  it('returns the original lists when nothing would be left', () => {
    expect(ids(excludeVideos([v('a')], [v('b')], new Set(['a', 'b'])))).toEqual([['a'], ['b']])
  })
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/trends/excludeVideos.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `src/lib/trends/excludeVideos.ts`

```ts
/**
 * 최근에 추천한 영상을 두 후보 목록에서 뺀다.
 * 둘 다 비게 되면 빈 화면 대신 원래 목록을 그대로 돌려준다.
 */
export function excludeVideos<T extends { videoId: string }>(
  channel: T[],
  keyword: T[],
  exclude: Iterable<string>,
): { channel: T[]; keyword: T[] } {
  const ids = new Set(exclude)
  const fresh = { channel: channel.filter((x) => !ids.has(x.videoId)), keyword: keyword.filter((x) => !ids.has(x.videoId)) }
  return fresh.channel.length === 0 && fresh.keyword.length === 0 ? { channel, keyword } : fresh
}
```

- [ ] **Step 4: `getTodayTrends` 연결**

1. import 추가: `import { excludeVideos } from './excludeVideos'`
2. 상수 추가: `/** 이 기간(오늘 제외) 안에 추천한 영상은 다시 추천하지 않는다. */ const RECENT_DAYS = 7`
3. 시그니처: `export async function getTodayTrends(workspaceId: string, { exclude = [] }: { exclude?: string[] } = {}): Promise<TrendsResult>` — doc 주석에 "최근 7일과 `exclude`의 영상은 후보에서 뺀다." 추가.
4. `Promise.all`에 세 번째 조회 추가, 구조 분해를 `[keywordRes, channelRes, recentRes]`로:

```ts
    supabase
      .from('trend_topics')
      .select('video_id')
      .eq('workspace_id', workspaceId)
      .gte('fetched_on', seoulDateString(new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000)))
      .lt('fetched_on', today),
```

5. `const pool = ...` 아래에:

```ts
  // 최근 기록 조회가 실패해도 추천은 막지 않는다.
  const recentIds = recentRes.error ? [] : (recentRes.data ?? []).map((r) => r.video_id as string)
  const groupByKeyword = new Map(keywordRows.map((k) => [k.keyword.trim().toLowerCase(), k.group_name ?? k.keyword]))
  const groupOf = (keyword: string) => groupByKeyword.get(keyword.trim().toLowerCase()) ?? keyword
```

6. `rotation` 아래: 그대로. fetch 부분:

```ts
      fetchChannelVideos({ apiKey, playlistIds, pool, boost: rotation.map((k) => k.keyword), now }),
```

```ts
    const fresh = excludeVideos(channelVideos, keywordVideos, [...exclude, ...recentIds])
    const picked = pickTrends(fresh.channel, fresh.keyword, { groupOf })
```

- [ ] **Step 5: `refetchTodayTrends` 연결** — `actions.ts`에서 `seoulDateString(new Date())`를 `const today`로 빼고, 삭제 전에:

```ts
  // 방금 보던 영상은 다시 가져올 때 빼서, 누를 때마다 새 영상이 나오게 한다. 읽기 실패는 무시.
  const { data: shown } = await supabase
    .from('trend_topics')
    .select('video_id')
    .eq('workspace_id', workspaceId)
    .eq('fetched_on', today)
  const exclude = (shown ?? []).map((r) => r.video_id as string)
```

그리고 `getTodayTrends(workspaceId, { exclude })`.

- [ ] **Step 6: 전체 확인** — `npx vitest run && npm run typecheck && npm run lint && npm run build` → 모두 통과

- [ ] **Step 7: 커밋** — `git add -A src && git commit -m "feat(trends): skip recently recommended videos and wire diversity"`

---

### Task 5: 브라우저 확인 · README

- [ ] 개발 서버에서 설정 → "오늘 트렌드 다시 가져오기"를 두 번 눌러, 두 번 모두 이전 화면과 다른 영상이 나오고 벤치마킹 섹션 매칭 태그가 한 주제로 쏠리지 않는지 확인.
- [ ] README 기능 설명(한/영 "오늘의 트렌드 추천")에 "겹치는 키워드는 한 번만 세고, 여러 주제를 섞고, 최근 7일 추천 영상은 빼요 / overlapping keywords count once, topics are mixed, videos picked in the last 7 days are skipped" 한 줄 추가, 테스트 개수 갱신.
- [ ] 커밋 — `git commit -am "docs: describe trend diversity in README"`
