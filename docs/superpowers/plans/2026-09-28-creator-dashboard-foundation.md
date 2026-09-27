# 크리에이터 대시보드 — 기능 뼈대 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 크리에이터가 유튜브/인스타그램 워크스페이스를 오가며 일정·체크리스트·칸반·아이디어·레퍼런스·해시태그·메모를 즉시 반영·실시간 동기화로 관리하고, 유튜브 워크스페이스에서 영어권 스토리텔링 니치의 트렌드 영상을 추천받는 대시보드의 기능 뼈대를 만든다.

**Architecture:** Next.js 16 App Router. 서버 컴포넌트가 Supabase에서 초기 데이터를 읽어 클라이언트 위젯에 넘기고, 위젯은 브라우저 Supabase 클라이언트로 직접 쓰기(낙관적 업데이트 + 실패 시 롤백)를 한다. 워크스페이스당 Supabase Realtime 채널 하나가 변경을 모든 위젯에 배포한다. 권한은 전부 Postgres RLS가 보호한다. 트렌드 갱신·언어 저장·로그아웃·워크스페이스 이름 변경만 서버 전용(Server Action/서버 함수)이다.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), TypeScript, Tailwind CSS 4, Supabase (`@supabase/supabase-js` 2.x, `@supabase/ssr` 0.12), next-intl 4 (URL 접두사 없는 쿠키 방식), zod 4, Vitest 5, YouTube Data API v3.

**Spec:** `docs/superpowers/specs/2026-09-28-creator-dashboard-foundation-design.md`

## Global Constraints

- 로케일은 `ko`, `en` 두 개. 쿠키 이름 `NEXT_LOCALE`. URL에 로케일 접두사 없음.
- 모든 UI 문구는 `messages/ko.json`, `messages/en.json`에 있어야 하며 두 파일의 키 구성이 같아야 한다. 컴포넌트에 한국어/영어 문자열을 하드코딩하지 않는다(언어 이름 `한국어`/`English` 제외).
- 트렌드 날짜 기준 시간대: `Asia/Seoul`. next-intl `timeZone`도 `Asia/Seoul`.
- 트렌드 검색: `relevanceLanguage=en`, `regionCode=US`, `order=viewCount`, `type=video`, 최근 7일, 키워드당 `maxResults=10`, 저장은 조회수 상위 8개.
- 기본 트렌드 키워드: `storytelling`, `authentic`, `raw story`.
- 인스타그램 워크스페이스에는 트렌드 위젯 없음.
- 자동 저장 지연: 800ms.
- 새 행의 `id`는 클라이언트에서 `crypto.randomUUID()`로 생성.
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `YOUTUBE_API_KEY`(서버 전용). 값은 사용자가 `.env.local`에 직접 넣는다. 에이전트는 키 값을 입력하거나 출력하지 않는다.
- 디자인 없음: 기본 Tailwind 유틸리티(회색 테두리, 기본 여백)만 사용. 색/폰트 시스템은 다음 서브프로젝트.
- 유료 서비스 사용 금지 (Supabase 무료 플랜, YouTube 무료 할당량만).
- 링크로 렌더링되는 사용자 입력 URL은 `http`/`https`만 허용.

## File Map

| 파일 | 책임 |
|---|---|
| `src/lib/dates.ts` | 한국 시간 기준 `YYYY-MM-DD` |
| `src/lib/types.ts` | 테이블 행 타입, 상수(플랫폼·종류·상태), `isPlatform`, `ActionResult` |
| `src/lib/supabase/{client,server}.ts` | 브라우저/서버 Supabase 클라이언트 |
| `src/lib/supabase/middleware.ts` | proxy용 세션 갱신 + 접근 제한 |
| `src/lib/auth/paths.ts` | 공개 경로 판별 |
| `src/lib/auth/errors.ts` | Supabase 인증 에러 코드 → 메시지 키 |
| `src/i18n/locale.ts` | 로케일 상수, 판별, 결정, 사용자 메타데이터에서 추출 |
| `src/i18n/request.ts` | next-intl 요청 설정 |
| `src/i18n/actions.ts` | `setLocale` Server Action |
| `src/i18n/sync.ts` | 로그인 후 사용자 메타데이터 → 쿠키 |
| `src/lib/realtime/applyChange.ts` | 목록 변경 순수 함수 (`applyChange`, `inverseOf`, `toChangeEvent`) |
| `src/lib/realtime/WorkspaceRealtime.tsx` | 채널 구독 Provider + 훅 |
| `src/lib/realtime/useLiveList.ts` | 낙관적 목록 상태 훅 |
| `src/lib/realtime/useAutosave.ts` | 디바운스 자동 저장 훅 |
| `src/lib/position.ts` | 정렬용 실수 position 계산 |
| `src/lib/validation.ts` | zod 스키마, 해시태그 정규화 |
| `src/lib/tableData.ts` | 테이블별 insert/update/delete 헬퍼 |
| `src/lib/workspace.ts` | 현재 사용자 워크스페이스 조회 |
| `src/lib/dashboard.ts` | 대시보드 초기 데이터 일괄 조회 |
| `src/lib/youtube/fetchTrends.ts` | YouTube API 호출 순수 함수 |
| `src/lib/youtube/videoUrl.ts` | 영상 ID → URL |
| `src/lib/trends/getTodayTrends.ts` | 오늘 트렌드 조회/갱신/폴백 |
| `src/components/{WidgetCard,EditableText}.tsx` | 공용 UI |
| `src/features/<widget>/…` | 위젯별 UI + `data.ts` |
| `src/app/…` | 라우트 |
| `supabase/migrations/0001_init.sql` | 스키마 + RLS + 트리거 + Realtime |
| `supabase/tests/rls_check.sql` | RLS 검증 스크립트 |
| `messages/{ko,en}.json` | UI 문구 |

---

### Task 1: 프로젝트 스캐폴딩 + Vitest + 한국 날짜 유틸

**Files:**
- Create: Next.js 기본 파일 일체 (create-next-app)
- Create: `vitest.config.ts`, `.env.example`
- Modify: `package.json` (scripts), `.gitignore`
- Create: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Produces: `seoulDateString(date: Date): string` — `"YYYY-MM-DD"` (Asia/Seoul 기준)
- Produces: `npm test` (vitest run), `npm run typecheck` (tsc --noEmit), `npm run lint`

- [ ] **Step 1: create-next-app 실행**

프로젝트 루트(`creator_dashboard/`, 이미 `.git`과 `docs/`가 있음)에서:

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

Expected: `src/app/page.tsx`, `src/app/layout.tsx`, `package.json` 등이 생성됨. `docs/`와 `.git`은 그대로.

- [ ] **Step 2: 의존성 설치**

```bash
npm install @supabase/supabase-js @supabase/ssr next-intl zod
npm install -D vitest
```

- [ ] **Step 3: Vitest 설정과 스크립트**

`vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

`package.json`의 `scripts`에 추가 (기존 `dev`/`build`/`start`/`lint`는 유지):

```json
"test": "vitest run",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: 환경변수 예시 파일**

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
YOUTUBE_API_KEY=
```

`.gitignore`에서 `.env*` 줄 바로 아래에 추가해 예시 파일만 커밋되게 한다:

```
!.env.example
```

- [ ] **Step 5: 실패하는 테스트 작성**

`src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { seoulDateString } from './dates'

describe('seoulDateString', () => {
  it('returns the Seoul calendar date just before Seoul midnight', () => {
    // 2026-09-28 23:59:59 KST
    expect(seoulDateString(new Date('2026-09-28T14:59:59Z'))).toBe('2026-09-28')
  })

  it('rolls over to the next day at Seoul midnight', () => {
    // 2026-09-29 00:00:00 KST
    expect(seoulDateString(new Date('2026-09-28T15:00:00Z'))).toBe('2026-09-29')
  })

  it('pads month and day', () => {
    expect(seoulDateString(new Date('2026-01-04T03:00:00Z'))).toBe('2026-01-04')
  })
})
```

- [ ] **Step 6: 실패 확인**

Run: `npm test -- src/lib/dates.test.ts`
Expected: FAIL — `Failed to resolve import "./dates"`

- [ ] **Step 7: 구현**

`src/lib/dates.ts`:

```ts
const seoulDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 한국 시간 기준 날짜를 "YYYY-MM-DD"로 반환한다. */
export function seoulDateString(date: Date): string {
  return seoulDate.format(date)
}
```

- [ ] **Step 8: 통과 확인**

Run: `npm test -- src/lib/dates.test.ts`
Expected: 3 passed

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and Seoul date util"
```

---

### Task 2: DB 스키마 · RLS · 타입 · Supabase 클라이언트

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `supabase/tests/rls_check.sql`
- Create: `src/lib/types.ts`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`

**Interfaces:**
- Produces (types.ts): `PLATFORMS`, `Platform`, `isPlatform(v: string): v is Platform`, `SCHEDULE_KINDS`, `ScheduleKind`, `KANBAN_STATUSES`, `KanbanStatus`, `REFERENCE_KINDS`, `ReferenceKind`, `WORKSPACE_TABLES`, `WorkspaceTable`, `LiveTable`, `Workspace`, `ScheduleItem`, `ChecklistItem`, `KanbanCard`, `TrendKeyword`, `TrendTopic`, `PinnedIdea`, `ReferenceItem`, `Hashtag`, `ActionResult`
- Produces: `createClient()` from `@/lib/supabase/client` (브라우저, 동기) / `createClient()` from `@/lib/supabase/server` (서버, `async`)

- [ ] **Step 1: 마이그레이션 SQL 작성**

`supabase/migrations/0001_init.sql`:

```sql
-- 크리에이터 대시보드 초기 스키마
-- Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 실행한다.

-- ───────────── workspaces ─────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  platform text not null check (platform in ('youtube', 'instagram')),
  name text not null check (char_length(name) between 1 and 50),
  memo text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, platform)
);

-- ───────────── 워크스페이스 소속 테이블 ─────────────
create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  title text not null,
  kind text not null check (kind in ('shoot', 'edit', 'upload')),
  scheduled_at timestamptz not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  content text not null,
  is_done boolean not null default false,
  position double precision not null,
  created_at timestamptz not null default now()
);

create table public.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  title text not null,
  status text not null check (status in ('shot', 'editing', 'review', 'uploaded')),
  position double precision not null,
  created_at timestamptz not null default now()
);

create table public.trend_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  keyword text not null check (char_length(keyword) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (workspace_id, keyword)
);

create table public.trend_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  fetched_on date not null,
  video_id text not null,
  title text not null,
  channel_title text not null,
  view_count bigint not null default 0,
  thumbnail_url text not null default '',
  created_at timestamptz not null default now(),
  unique (workspace_id, fetched_on, video_id)
);

create table public.pinned_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  title text not null,
  note text not null default '',
  source_url text,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

create table public.reference_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  kind text not null check (kind in ('thumbnail', 'topic', 'sound', 'font', 'other')),
  title text not null,
  url text,
  image_url text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.hashtags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  tag text not null check (char_length(tag) between 1 and 100),
  group_name text,
  created_at timestamptz not null default now(),
  unique (workspace_id, tag)
);

-- ───────────── 인덱스 ─────────────
create index on public.schedule_items (workspace_id);
create index on public.checklist_items (workspace_id);
create index on public.kanban_cards (workspace_id);
create index on public.pinned_ideas (workspace_id);
create index on public.reference_items (workspace_id);

-- ───────────── RLS ─────────────
create function public.owns_workspace(ws uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.user_id = (select auth.uid())
  );
$$;

alter table public.workspaces enable row level security;

create policy "workspaces: select own" on public.workspaces
  for select to authenticated using (user_id = (select auth.uid()));
create policy "workspaces: update own" on public.workspaces
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, update on public.workspaces to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'schedule_items', 'checklist_items', 'kanban_cards', 'trend_keywords',
    'trend_topics', 'pinned_ideas', 'reference_items', 'hashtags'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: select own" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: insert own" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()) and public.owns_workspace(workspace_id))', t);
    execute format(
      'create policy "%1$s: update own" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.owns_workspace(workspace_id))', t);
    execute format(
      'create policy "%1$s: delete own" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ───────────── 가입 시 초기 데이터 ─────────────
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  yt uuid;
begin
  insert into public.workspaces (user_id, platform, name)
    values (new.id, 'youtube', 'YouTube')
    returning id into yt;
  insert into public.workspaces (user_id, platform, name)
    values (new.id, 'instagram', 'Instagram');
  insert into public.trend_keywords (user_id, workspace_id, keyword)
    values (new.id, yt, 'storytelling'), (new.id, yt, 'authentic'), (new.id, yt, 'raw story');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Realtime ─────────────
alter publication supabase_realtime add table
  public.workspaces,
  public.schedule_items,
  public.checklist_items,
  public.kanban_cards,
  public.trend_keywords,
  public.pinned_ideas,
  public.reference_items,
  public.hashtags;
```

- [ ] **Step 2: RLS 검증 스크립트 작성**

`supabase/tests/rls_check.sql`:

```sql
-- RLS 검증: SQL Editor에서 전체 실행. 마지막에 'RLS OK'가 나오면 통과.
-- 트랜잭션을 rollback하므로 데이터가 남지 않는다.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@test.local');

-- 트리거가 사용자마다 워크스페이스 2개 + 키워드 3개를 만들었는지
do $$
begin
  if (select count(*) from public.workspaces
      where user_id = '00000000-0000-0000-0000-00000000000a') <> 2 then
    raise exception 'FAIL: signup trigger did not create 2 workspaces';
  end if;
  if (select count(*) from public.trend_keywords
      where user_id = '00000000-0000-0000-0000-00000000000a') <> 3 then
    raise exception 'FAIL: signup trigger did not create 3 keywords';
  end if;
end $$;

select set_config('test.a_ws',
  (select id::text from public.workspaces
   where user_id = '00000000-0000-0000-0000-00000000000a' and platform = 'youtube'),
  true);

-- 사용자 A로 행 하나 생성
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.checklist_items (workspace_id, content, position)
  values (current_setting('test.a_ws')::uuid, 'A secret', 1);

-- 사용자 B로 전환
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  if exists (select 1 from public.checklist_items) then
    raise exception 'FAIL: B can read A checklist';
  end if;
  if (select count(*) from public.workspaces) <> 2 then
    raise exception 'FAIL: B should see exactly its own 2 workspaces';
  end if;

  update public.checklist_items set content = 'hacked';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B updated A rows'; end if;

  delete from public.checklist_items;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A rows'; end if;

  begin
    insert into public.checklist_items (workspace_id, content, position)
      values (current_setting('test.a_ws')::uuid, 'intrusion', 1);
    raise exception 'FAIL: B inserted into A workspace';
  exception when insufficient_privilege then
    null; -- 기대한 RLS 거부
  end;
end $$;

select 'RLS OK' as result;
rollback;
```

- [ ] **Step 3: 공용 타입 작성**

`src/lib/types.ts`:

```ts
export const PLATFORMS = ['youtube', 'instagram'] as const
export type Platform = (typeof PLATFORMS)[number]

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value)
}

export const SCHEDULE_KINDS = ['shoot', 'edit', 'upload'] as const
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number]

export const KANBAN_STATUSES = ['shot', 'editing', 'review', 'uploaded'] as const
export type KanbanStatus = (typeof KANBAN_STATUSES)[number]

export const REFERENCE_KINDS = ['thumbnail', 'topic', 'sound', 'font', 'other'] as const
export type ReferenceKind = (typeof REFERENCE_KINDS)[number]

/** workspace_id 컬럼이 있고 Realtime으로 구독하는 테이블 */
export const WORKSPACE_TABLES = [
  'schedule_items',
  'checklist_items',
  'kanban_cards',
  'pinned_ideas',
  'reference_items',
  'hashtags',
  'trend_keywords',
] as const
export type WorkspaceTable = (typeof WORKSPACE_TABLES)[number]
export type LiveTable = WorkspaceTable | 'workspaces'

export type Workspace = {
  id: string
  user_id: string
  platform: Platform
  name: string
  memo: string
  created_at: string
}

type WorkspaceRow = { id: string; workspace_id: string; created_at: string }

export type ScheduleItem = WorkspaceRow & {
  title: string
  kind: ScheduleKind
  scheduled_at: string
  is_done: boolean
}

export type ChecklistItem = WorkspaceRow & {
  content: string
  is_done: boolean
  position: number
}

export type KanbanCard = WorkspaceRow & {
  title: string
  status: KanbanStatus
  position: number
}

export type TrendKeyword = WorkspaceRow & { keyword: string }

export type TrendTopic = WorkspaceRow & {
  fetched_on: string
  video_id: string
  title: string
  channel_title: string
  view_count: number
  thumbnail_url: string
}

export type PinnedIdea = WorkspaceRow & {
  title: string
  note: string
  source_url: string | null
  thumbnail_url: string | null
}

export type ReferenceItem = WorkspaceRow & {
  kind: ReferenceKind
  title: string
  url: string | null
  image_url: string | null
  note: string
}

export type Hashtag = WorkspaceRow & {
  tag: string
  group_name: string | null
}

export type ActionResult = { ok: true } | { error: string }
```

- [ ] **Step 4: Supabase 클라이언트 작성**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

/** 브라우저용 Supabase 클라이언트. @supabase/ssr가 브라우저에서는 싱글턴으로 재사용한다. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** 서버 컴포넌트·Server Action·Route Handler용 Supabase 클라이언트 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy가 맡는다.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 5: 타입 체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 6: ⏸ 사용자 체크포인트 — Supabase에 마이그레이션 적용**

에이전트는 여기서 멈추고 사용자에게 요청한다:
1. supabase.com에서 프로젝트 생성(무료 플랜)
2. SQL Editor에서 `supabase/migrations/0001_init.sql` 전체 실행
3. 이어서 `supabase/tests/rls_check.sql` 실행 → 결과가 `RLS OK`인지 확인
4. Project Settings → API에서 URL과 anon key를 `.env.local`에 입력 (`.env.example` 복사)

사용자가 `RLS OK`를 확인해 주면 다음 단계로 간다. 실패 메시지(`FAIL: ...`)가 나오면 해당 정책을 고친다.

- [ ] **Step 7: Commit**

```bash
git add supabase src/lib/types.ts src/lib/supabase
git commit -m "feat: add database schema, RLS, shared types, and Supabase clients"
```

---

### Task 3: 다국어 (next-intl, ko/en)

**Files:**
- Create: `src/i18n/locale.ts`, `src/i18n/request.ts`, `src/i18n/actions.ts`, `src/i18n/sync.ts`
- Create: `messages/ko.json`, `messages/en.json`
- Modify: `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`
- Test: `src/i18n/locale.test.ts`, `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: `createClient` (server), `ActionResult`
- Produces: `LOCALES`, `Locale`, `LOCALE_COOKIE`, `LOCALE_COOKIE_OPTIONS`, `isLocale(v: unknown): v is Locale`, `resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Locale`, `localeFromUser(user: { user_metadata?: Record<string, unknown> } | null): Locale | null`
- Produces: `setLocale(locale: Locale): Promise<ActionResult>` (Server Action)
- Produces: `syncLocaleCookie(user: User | null): Promise<void>`
- Produces: 메시지 키 전체 (이후 모든 태스크가 사용)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/i18n/locale.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isLocale, localeFromUser, resolveLocale } from './locale'

describe('isLocale', () => {
  it('accepts ko and en only', () => {
    expect(isLocale('ko')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('ja')).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

describe('resolveLocale', () => {
  it('prefers a valid cookie', () => {
    expect(resolveLocale('en', 'ko-KR,ko;q=0.9')).toBe('en')
  })

  it('ignores an invalid cookie and falls back to Accept-Language', () => {
    expect(resolveLocale('fr', 'ko-KR,ko;q=0.9')).toBe('ko')
  })

  it('picks ko when Korean appears anywhere in Accept-Language', () => {
    expect(resolveLocale(undefined, 'en-US,en;q=0.9,ko;q=0.8')).toBe('ko')
  })

  it('defaults to en otherwise', () => {
    expect(resolveLocale(undefined, 'en-US,en;q=0.9')).toBe('en')
    expect(resolveLocale(undefined, null)).toBe('en')
  })
})

describe('localeFromUser', () => {
  it('reads a valid locale from user metadata', () => {
    expect(localeFromUser({ user_metadata: { locale: 'ko' } })).toBe('ko')
  })

  it('returns null for missing or invalid metadata', () => {
    expect(localeFromUser(null)).toBeNull()
    expect(localeFromUser({ user_metadata: {} })).toBeNull()
    expect(localeFromUser({ user_metadata: { locale: 'de' } })).toBeNull()
  })
})
```

`src/i18n/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import ko from '../../messages/ko.json'

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

describe('messages', () => {
  it('ko and en define exactly the same keys', () => {
    expect(keys(ko).sort()).toEqual(keys(en).sort())
  })

  it('has no empty strings', () => {
    const empty = (obj: unknown): boolean =>
      typeof obj === 'string' ? obj.trim() === '' : Object.values(obj as object).some(empty)
    expect(empty(ko)).toBe(false)
    expect(empty(en)).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/i18n`
Expected: FAIL — `./locale`, `../../messages/en.json`을 찾을 수 없음

- [ ] **Step 3: locale.ts 구현**

`src/i18n/locale.ts`:

```ts
export const LOCALES = ['ko', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_COOKIE = 'NEXT_LOCALE'
export const LOCALE_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** 쿠키가 유효하면 쿠키, 아니면 Accept-Language에 한국어가 있으면 ko, 그 외 en */
export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie
  return /\bko\b/i.test(acceptLanguage ?? '') ? 'ko' : 'en'
}

export function localeFromUser(
  user: { user_metadata?: Record<string, unknown> } | null,
): Locale | null {
  const locale = user?.user_metadata?.locale
  return isLocale(locale) ? locale : null
}
```

- [ ] **Step 4: 메시지 파일 작성**

`messages/ko.json`:

```json
{
  "meta": {
    "title": "크리에이터 대시보드",
    "description": "유튜브·인스타그램 크리에이터를 위한 올인원 대시보드"
  },
  "common": {
    "add": "추가",
    "delete": "삭제",
    "done": "완료",
    "saveFailed": "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    "saving": "저장 중…",
    "saved": "저장됨",
    "moveUp": "위로",
    "moveDown": "아래로",
    "moveLeft": "이전 단계로",
    "moveRight": "다음 단계로",
    "loadFailed": "대시보드를 불러오지 못했어요.",
    "retry": "다시 시도"
  },
  "auth": {
    "title": "크리에이터 대시보드",
    "loginTab": "로그인",
    "signupTab": "회원가입",
    "email": "이메일",
    "password": "비밀번호 (6자 이상)",
    "submitLogin": "로그인",
    "submitSignup": "가입하기",
    "or": "또는",
    "google": "Google로 계속하기",
    "checkEmail": "인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 완료돼요.",
    "errors": {
      "invalidInput": "이메일과 비밀번호(6자 이상)를 확인해 주세요.",
      "invalidCredentials": "이메일 또는 비밀번호가 올바르지 않아요.",
      "emailNotConfirmed": "메일 인증을 먼저 완료해 주세요.",
      "userExists": "이미 가입된 이메일이에요.",
      "weakPassword": "비밀번호가 너무 약해요.",
      "callback": "로그인을 완료하지 못했어요. 다시 시도해 주세요.",
      "generic": "문제가 생겼어요. 잠시 후 다시 시도해 주세요."
    }
  },
  "nav": {
    "youtube": "YouTube",
    "instagram": "Instagram",
    "settings": "설정",
    "logout": "로그아웃"
  },
  "dashboard": {
    "today": "오늘 할 일",
    "explore": "탐색 · 영감"
  },
  "schedule": {
    "title": "업로드 일정",
    "titleLabel": "일정 제목",
    "kindLabel": "종류",
    "whenLabel": "날짜와 시간",
    "empty": "등록된 일정이 없어요.",
    "kinds": {
      "shoot": "촬영",
      "edit": "편집",
      "upload": "업로드"
    }
  },
  "checklist": {
    "title": "촬영 체크리스트",
    "itemLabel": "체크리스트 항목",
    "empty": "체크리스트가 비어 있어요."
  },
  "kanban": {
    "title": "편집 진행 상태",
    "cardLabel": "영상 제목",
    "emptyColumn": "없음",
    "statuses": {
      "shot": "촬영완료",
      "editing": "편집중",
      "review": "검수중",
      "uploaded": "업로드완료"
    }
  },
  "trends": {
    "title": "오늘의 트렌드 추천",
    "loading": "트렌드를 불러오는 중…",
    "empty": "오늘은 추천할 영상을 찾지 못했어요.",
    "noKeywords": "트렌드 검색 키워드가 없어요.",
    "goToSettings": "설정에서 추가하기",
    "failed": "트렌드를 불러오지 못했어요.",
    "showingFrom": "{date} 기준 주제를 보여드려요.",
    "views": "조회수 {count, number}회",
    "pin": "고정",
    "pinned": "고정됨"
  },
  "ideas": {
    "title": "고정된 아이디어",
    "titleLabel": "아이디어",
    "noteLabel": "메모 (선택)",
    "empty": "고정된 아이디어가 없어요.",
    "source": "원본 보기"
  },
  "references": {
    "title": "최근 저장한 레퍼런스",
    "kindLabel": "종류",
    "titleLabel": "제목",
    "urlLabel": "링크 (선택)",
    "imageUrlLabel": "이미지 URL (선택)",
    "noteLabel": "메모 (선택)",
    "empty": "저장한 레퍼런스가 없어요.",
    "open": "열기",
    "invalidUrl": "링크는 http:// 또는 https://로 시작하는 주소여야 해요.",
    "kinds": {
      "thumbnail": "썸네일",
      "topic": "주제",
      "sound": "효과음",
      "font": "폰트",
      "other": "기타"
    }
  },
  "hashtags": {
    "title": "해시태그 뱅크",
    "tagLabel": "해시태그",
    "groupLabel": "그룹 (선택)",
    "empty": "저장한 해시태그가 없어요.",
    "ungrouped": "그룹 없음",
    "duplicate": "이미 있는 해시태그예요."
  },
  "memo": {
    "title": "빠른 메모",
    "label": "빠른 메모",
    "placeholder": "떠오르는 생각을 적어 두세요."
  },
  "performance": {
    "title": "성과 스냅샷",
    "comingSoon": "성과 분석은 준비 중이에요."
  },
  "settings": {
    "title": "설정",
    "account": "계정",
    "language": "언어",
    "workspace": "워크스페이스",
    "workspaceName": "워크스페이스 이름",
    "trendKeywords": "트렌드 검색 키워드",
    "keywordLabel": "키워드",
    "keywordsHelp": "영어권 YouTube에서 최근 7일간 조회수가 높은 영상을 이 키워드로 찾아요.",
    "keywordsEmpty": "키워드가 없어요.",
    "keywordDuplicate": "이미 있는 키워드예요.",
    "refetch": "오늘 트렌드 다시 가져오기",
    "refetchDone": "오늘 트렌드를 새로 가져왔어요.",
    "refetchFailed": "트렌드를 가져오지 못했어요."
  }
}
```

`messages/en.json`:

```json
{
  "meta": {
    "title": "Creator Dashboard",
    "description": "All-in-one dashboard for YouTube and Instagram creators"
  },
  "common": {
    "add": "Add",
    "delete": "Delete",
    "done": "Done",
    "saveFailed": "Couldn't save. Please try again.",
    "saving": "Saving…",
    "saved": "Saved",
    "moveUp": "Move up",
    "moveDown": "Move down",
    "moveLeft": "Previous stage",
    "moveRight": "Next stage",
    "loadFailed": "Couldn't load the dashboard.",
    "retry": "Try again"
  },
  "auth": {
    "title": "Creator Dashboard",
    "loginTab": "Log in",
    "signupTab": "Sign up",
    "email": "Email",
    "password": "Password (6+ characters)",
    "submitLogin": "Log in",
    "submitSignup": "Create account",
    "or": "or",
    "google": "Continue with Google",
    "checkEmail": "We sent you a confirmation email. Click the link to finish signing up.",
    "errors": {
      "invalidInput": "Check your email and password (6+ characters).",
      "invalidCredentials": "Incorrect email or password.",
      "emailNotConfirmed": "Please confirm your email first.",
      "userExists": "This email is already registered.",
      "weakPassword": "That password is too weak.",
      "callback": "Couldn't finish signing in. Please try again.",
      "generic": "Something went wrong. Please try again."
    }
  },
  "nav": {
    "youtube": "YouTube",
    "instagram": "Instagram",
    "settings": "Settings",
    "logout": "Log out"
  },
  "dashboard": {
    "today": "Today",
    "explore": "Explore & inspiration"
  },
  "schedule": {
    "title": "Upload schedule",
    "titleLabel": "Title",
    "kindLabel": "Type",
    "whenLabel": "Date and time",
    "empty": "Nothing scheduled.",
    "kinds": {
      "shoot": "Shoot",
      "edit": "Edit",
      "upload": "Upload"
    }
  },
  "checklist": {
    "title": "Shooting checklist",
    "itemLabel": "Checklist item",
    "empty": "Your checklist is empty."
  },
  "kanban": {
    "title": "Editing progress",
    "cardLabel": "Video title",
    "emptyColumn": "None",
    "statuses": {
      "shot": "Shot",
      "editing": "Editing",
      "review": "In review",
      "uploaded": "Uploaded"
    }
  },
  "trends": {
    "title": "Today's trending topics",
    "loading": "Loading trends…",
    "empty": "No videos to recommend today.",
    "noKeywords": "You have no trend keywords.",
    "goToSettings": "Add some in Settings",
    "failed": "Couldn't load trends.",
    "showingFrom": "Showing topics from {date}.",
    "views": "{count, number} views",
    "pin": "Pin",
    "pinned": "Pinned"
  },
  "ideas": {
    "title": "Pinned ideas",
    "titleLabel": "Idea",
    "noteLabel": "Note (optional)",
    "empty": "No pinned ideas yet.",
    "source": "View source"
  },
  "references": {
    "title": "Recent references",
    "kindLabel": "Type",
    "titleLabel": "Title",
    "urlLabel": "Link (optional)",
    "imageUrlLabel": "Image URL (optional)",
    "noteLabel": "Note (optional)",
    "empty": "No saved references.",
    "open": "Open",
    "invalidUrl": "Links must start with http:// or https://.",
    "kinds": {
      "thumbnail": "Thumbnail",
      "topic": "Topic",
      "sound": "Sound effect",
      "font": "Font",
      "other": "Other"
    }
  },
  "hashtags": {
    "title": "Hashtag bank",
    "tagLabel": "Hashtag",
    "groupLabel": "Group (optional)",
    "empty": "No saved hashtags.",
    "ungrouped": "Ungrouped",
    "duplicate": "That hashtag already exists."
  },
  "memo": {
    "title": "Quick notes",
    "label": "Quick notes",
    "placeholder": "Jot down whatever comes to mind."
  },
  "performance": {
    "title": "Performance snapshot",
    "comingSoon": "Performance analytics is coming soon."
  },
  "settings": {
    "title": "Settings",
    "account": "Account",
    "language": "Language",
    "workspace": "Workspace",
    "workspaceName": "Workspace name",
    "trendKeywords": "Trend search keywords",
    "keywordLabel": "Keyword",
    "keywordsHelp": "We use these keywords to find the most-viewed English YouTube videos from the last 7 days.",
    "keywordsEmpty": "No keywords yet.",
    "keywordDuplicate": "That keyword already exists.",
    "refetch": "Fetch today's trends again",
    "refetchDone": "Fetched today's trends.",
    "refetchFailed": "Couldn't fetch trends."
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- src/i18n`
Expected: locale 7개 + messages 2개 passed

- [ ] **Step 6: next-intl 연결**

`src/i18n/request.ts`:

```ts
import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { LOCALE_COOKIE, resolveLocale } from './locale'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get('accept-language'),
  )

  return {
    locale,
    timeZone: 'Asia/Seoul',
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
```

`next.config.ts` 전체를 교체:

```ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {}

export default withNextIntl(nextConfig)
```

`src/app/globals.css` 전체를 교체 (기본 다크모드 변수 제거 — 디자인은 다음 서브프로젝트):

```css
@import "tailwindcss";
```

`src/app/layout.tsx` 전체를 교체:

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('title'), description: t('description') }
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getLocale()

  return (
    <html lang={locale}>
      <body className="bg-white text-gray-900 antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: 언어 저장 액션과 쿠키 동기화**

`src/i18n/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, type Locale } from './locale'

export async function setLocale(locale: Locale): Promise<ActionResult> {
  if (!isLocale(locale)) return { error: 'invalid-locale' }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { error } = await supabase.auth.updateUser({ data: { locale } })
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
```

`src/i18n/sync.ts`:

```ts
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS, localeFromUser } from './locale'

/** 로그인 직후, 계정에 저장된 언어를 이 브라우저의 쿠키로 옮긴다. */
export async function syncLocaleCookie(user: User | null): Promise<void> {
  const locale = localeFromUser(user)
  if (!locale) return
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS)
}
```

- [ ] **Step 8: 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 전체 통과, 에러 없음

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add ko/en i18n with cookie-based locale"
```

---

### Task 4: 인증 — proxy, 로그인/회원가입, 구글 OAuth, 콜백

**Files:**
- Create: `src/lib/auth/paths.ts`, `src/lib/auth/errors.ts`
- Create: `src/lib/supabase/middleware.ts`, `src/proxy.ts`
- Create: `src/app/login/page.tsx`, `src/app/login/LoginForm.tsx`, `src/app/login/actions.ts`
- Create: `src/app/auth/callback/route.ts`
- Modify: `src/app/page.tsx`
- Test: `src/lib/auth/paths.test.ts`, `src/lib/auth/errors.test.ts`

**Interfaces:**
- Consumes: `createClient` (server/browser), `syncLocaleCookie`, 메시지 `auth.*`
- Produces: `isPublicPath(pathname: string): boolean`, `AuthErrorKey`, `authErrorKey(code: string | undefined): AuthErrorKey`, `updateSession(request: NextRequest): Promise<NextResponse>`
- Produces: `authenticate(prev: AuthState, formData: FormData): Promise<AuthState>` (Server Action), `AuthState = { error?: AuthErrorKey; notice?: 'checkEmail' } | undefined`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/auth/paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isPublicPath } from './paths'

describe('isPublicPath', () => {
  it('allows the login page and auth routes', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
  })

  it('protects everything else', () => {
    expect(isPublicPath('/')).toBe(false)
    expect(isPublicPath('/youtube')).toBe(false)
    expect(isPublicPath('/loginx')).toBe(false)
    expect(isPublicPath('/authors')).toBe(false)
  })
})
```

`src/lib/auth/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { authErrorKey } from './errors'

describe('authErrorKey', () => {
  it('maps known Supabase error codes', () => {
    expect(authErrorKey('invalid_credentials')).toBe('invalidCredentials')
    expect(authErrorKey('email_not_confirmed')).toBe('emailNotConfirmed')
    expect(authErrorKey('user_already_exists')).toBe('userExists')
    expect(authErrorKey('email_exists')).toBe('userExists')
    expect(authErrorKey('weak_password')).toBe('weakPassword')
  })

  it('falls back to generic', () => {
    expect(authErrorKey('over_request_rate_limit')).toBe('generic')
    expect(authErrorKey(undefined)).toBe('generic')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/auth`
Expected: FAIL — `./paths`, `./errors`를 찾을 수 없음

- [ ] **Step 3: 구현**

`src/lib/auth/paths.ts`:

```ts
const PUBLIC_PATHS = ['/login', '/auth']

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
```

`src/lib/auth/errors.ts`:

```ts
export type AuthErrorKey =
  | 'invalidInput'
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'userExists'
  | 'weakPassword'
  | 'callback'
  | 'generic'

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  user_already_exists: 'userExists',
  email_exists: 'userExists',
  weak_password: 'weakPassword',
}

/** Supabase AuthError.code → messages의 auth.errors 키 */
export function authErrorKey(code: string | undefined): AuthErrorKey {
  return (code && BY_CODE[code]) || 'generic'
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/lib/auth`
Expected: 4 passed

- [ ] **Step 5: 세션 갱신 proxy**

`src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPublicPath } from '@/lib/auth/paths'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser()가 만료된 토큰을 갱신한다. 이 호출과 createServerClient 사이에 다른 코드를 넣지 않는다.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  if (!user && !isPublicPath(pathname)) return redirectTo(request, response, '/login')
  if (user && pathname === '/login') return redirectTo(request, response, '/youtube')
  return response
}

/** 리다이렉트하면서 방금 갱신된 세션 쿠키를 잃지 않게 옮겨 담는다. */
function redirectTo(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirect = NextResponse.redirect(url)
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}
```

`src/proxy.ts`:

```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 6: 로그인 Server Action**

`src/app/login/actions.ts`:

```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { authErrorKey, type AuthErrorKey } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/server'
import { syncLocaleCookie } from '@/i18n/sync'

export type AuthState = { error?: AuthErrorKey; notice?: 'checkEmail' } | undefined

const credentials = z.object({
  mode: z.enum(['login', 'signup']),
  email: z.email(),
  password: z.string().min(6).max(72),
})

export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'invalidInput' }
  const { mode, email, password } = parsed.data

  const supabase = await createClient()

  if (mode === 'login') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: authErrorKey(error.code) }
    await syncLocaleCookie(data.user)
    redirect('/youtube')
  }

  const origin = (await headers()).get('origin') ?? ''
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: { locale: await getLocale() },
    },
  })
  if (error) return { error: authErrorKey(error.code) }
  // 메일 인증이 켜져 있으면 세션 없이 돌아온다.
  if (!data.session) return { notice: 'checkEmail' }
  redirect('/youtube')
}
```

- [ ] **Step 7: 로그인 화면**

`src/app/login/LoginForm.tsx`:

```tsx
'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AuthErrorKey } from '@/lib/auth/errors'
import { createClient } from '@/lib/supabase/client'
import { authenticate } from './actions'

type Mode = 'login' | 'signup'

export function LoginForm({ callbackFailed }: { callbackFailed: boolean }) {
  const t = useTranslations('auth')
  const [mode, setMode] = useState<Mode>('login')
  const [state, formAction, pending] = useActionState(authenticate, undefined)
  const [oauthFailed, setOauthFailed] = useState(false)

  async function continueWithGoogle() {
    setOauthFailed(false)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setOauthFailed(true)
  }

  const errorKey: AuthErrorKey | null =
    state?.error ?? (oauthFailed ? 'generic' : callbackFailed ? 'callback' : null)

  return (
    <main className="mx-auto mt-24 flex max-w-sm flex-col gap-4 px-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <div role="tablist" className="flex gap-2">
        {(['login', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1 text-sm ${
              mode === m ? 'bg-gray-900 text-white' : 'border border-gray-300'
            }`}
          >
            {t(m === 'login' ? 'loginTab' : 'signupTab')}
          </button>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="mode" value={mode} />
        <label className="flex flex-col gap-1 text-sm">
          {t('email')}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('password')}
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>

        {errorKey && (
          <p role="alert" className="text-sm text-red-600">
            {t(`errors.${errorKey}`)}
          </p>
        )}
        {state?.notice === 'checkEmail' && (
          <p role="status" className="text-sm text-green-700">
            {t('checkEmail')}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {t(mode === 'login' ? 'submitLogin' : 'submitSignup')}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">{t('or')}</p>
      <button
        type="button"
        onClick={() => void continueWithGoogle()}
        className="rounded border border-gray-300 px-3 py-2"
      >
        {t('google')}
      </button>
    </main>
  )
}
```

`src/app/login/page.tsx`:

```tsx
import { LoginForm } from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return <LoginForm callbackFailed={error === 'callback'} />
}
```

- [ ] **Step 8: OAuth/메일 인증 콜백과 루트 페이지**

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncLocaleCookie } from '@/i18n/sync'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await syncLocaleCookie(data.user)
      return NextResponse.redirect(`${origin}/youtube`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback`)
}
```

`src/app/page.tsx` 전체를 교체:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/youtube')
}
```

- [ ] **Step 9: 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 통과

`.env.local`이 준비돼 있으면 `npm run dev` 후 브라우저로 확인:
- `http://localhost:3000/` → `/login`으로 이동
- 회원가입 → (메일 인증이 켜져 있으면) 인증 메일 안내 표시
- 가입 후 Supabase Table Editor에서 `workspaces` 2행, `trend_keywords` 3행 생성 확인
- 로그인 → `/youtube`로 이동 (아직 404여도 정상 — Task 6에서 페이지 생성)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add email/password and Google auth with protected routes"
```

---
### Task 5: 즉시 반영 · 실시간 동기화 핵심

**Files:**
- Create: `src/lib/realtime/applyChange.ts`
- Create: `src/lib/position.ts`, `src/lib/validation.ts`
- Create: `src/lib/realtime/WorkspaceRealtime.tsx`, `src/lib/realtime/useLiveList.ts`, `src/lib/realtime/useAutosave.ts`
- Create: `src/lib/tableData.ts`
- Create: `src/components/WidgetCard.tsx`, `src/components/EditableText.tsx`
- Test: `src/lib/realtime/applyChange.test.ts`, `src/lib/position.test.ts`, `src/lib/validation.test.ts`

**Interfaces:**
- Consumes: `LiveTable`, `WorkspaceTable`, `WORKSPACE_TABLES` (types.ts), `createClient` (browser)
- Produces (applyChange.ts): `Row = { id: string }`, `ChangeEvent<T>`, `RealtimePayload`, `applyChange(list, event, compare?)`, `inverseOf(list, event)`, `toChangeEvent(payload)`
- Produces (position.ts): `positionAfter(positions: number[]): number`, `positionBetween(before?: number, after?: number): number`
- Produces (validation.ts): `textSchema`, `optionalUrlSchema` (→ `string | null`), `normalizeTag(input: string): string`
- Produces (WorkspaceRealtime.tsx): `<WorkspaceRealtime workspaceId>`, `useWorkspaceId(): string`, `useResyncKey(): number`, `useRealtimeTable<T extends Row>(table: LiveTable, handler: (e: ChangeEvent<T>) => void): void`
- Produces (useLiveList.ts): `useLiveList<T extends Row>(table: WorkspaceTable, initial: T[], compare?: (a: T, b: T) => number): { rows: T[]; mutate(event: ChangeEvent<T>, write: () => PromiseLike<WriteResult>): Promise<boolean>; error: string | null }`
- Produces (useAutosave.ts): `useAutosave(save: (value: string) => Promise<boolean>, delay?: number): { status: AutosaveStatus; schedule(value: string): void; flush(): Promise<void> }`, `AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'`
- Produces (tableData.ts): `tableData<T extends Row>(table: WorkspaceTable): { insert(row: T); update(id: string, patch: Partial<T>); remove(id: string) }` — 각각 Supabase 쿼리 빌더(`PromiseLike<{ error }>`) 반환
- Produces: `<WidgetCard title error? children>`, `<EditableText value onSave label className?>` (`onSave: (v: string) => Promise<boolean>`)

- [ ] **Step 1: applyChange 실패 테스트**

`src/lib/realtime/applyChange.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyChange, inverseOf, toChangeEvent, type ChangeEvent } from './applyChange'

type Item = { id: string; n: number }
const byN = (a: Item, b: Item) => a.n - b.n
const list: Item[] = [
  { id: 'a', n: 1 },
  { id: 'b', n: 2 },
]

describe('applyChange', () => {
  it('appends an inserted row', () => {
    expect(applyChange(list, { type: 'INSERT', row: { id: 'c', n: 3 } })).toEqual([
      ...list,
      { id: 'c', n: 3 },
    ])
  })

  it('treats an INSERT for an existing id as a replace (realtime echo of an optimistic insert)', () => {
    const next = applyChange(list, { type: 'INSERT', row: { id: 'a', n: 1 } })
    expect(next).toHaveLength(2)
  })

  it('replaces an updated row and re-sorts with compare', () => {
    const next = applyChange(list, { type: 'UPDATE', row: { id: 'a', n: 5 } }, byN)
    expect(next.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('upserts an UPDATE for an unknown id', () => {
    expect(applyChange(list, { type: 'UPDATE', row: { id: 'z', n: 0 } }, byN)[0].id).toBe('z')
  })

  it('removes a deleted row', () => {
    expect(applyChange(list, { type: 'DELETE', id: 'a' })).toEqual([{ id: 'b', n: 2 }])
  })

  it('returns the same array for a DELETE of an unknown id', () => {
    expect(applyChange(list, { type: 'DELETE', id: 'other-workspace-row' })).toBe(list)
  })
})

describe('inverseOf', () => {
  it('undoes an insert with a delete', () => {
    expect(inverseOf(list, { type: 'INSERT', row: { id: 'c', n: 3 } })).toEqual({
      type: 'DELETE',
      id: 'c',
    })
  })

  it('undoes an update by restoring the previous row', () => {
    expect(inverseOf(list, { type: 'UPDATE', row: { id: 'a', n: 9 } })).toEqual({
      type: 'UPDATE',
      row: { id: 'a', n: 1 },
    })
  })

  it('undoes a delete by re-inserting the previous row', () => {
    expect(inverseOf(list, { type: 'DELETE', id: 'b' })).toEqual({
      type: 'INSERT',
      row: { id: 'b', n: 2 },
    })
  })

  it('returns null when deleting something that is not there', () => {
    expect(inverseOf(list, { type: 'DELETE', id: 'zz' })).toBeNull()
  })

  it.each<ChangeEvent<Item>>([
    { type: 'INSERT', row: { id: 'c', n: 0 } },
    { type: 'UPDATE', row: { id: 'b', n: -1 } },
    { type: 'DELETE', id: 'a' },
  ])('round-trips %o back to the original list', (event) => {
    const applied = applyChange(list, event, byN)
    const inverse = inverseOf(list, event)!
    expect(applyChange(applied, inverse, byN)).toEqual(list)
  })
})

describe('toChangeEvent', () => {
  it('maps INSERT and UPDATE payloads to their new row', () => {
    expect(toChangeEvent({ eventType: 'INSERT', new: { id: 'a' }, old: {} })).toEqual({
      type: 'INSERT',
      row: { id: 'a' },
    })
    expect(toChangeEvent({ eventType: 'UPDATE', new: { id: 'a' }, old: { id: 'a' } })).toEqual({
      type: 'UPDATE',
      row: { id: 'a' },
    })
  })

  it('maps DELETE payloads to the old id', () => {
    expect(toChangeEvent({ eventType: 'DELETE', new: {}, old: { id: 'a' } })).toEqual({
      type: 'DELETE',
      id: 'a',
    })
  })

  it('ignores a DELETE without an id', () => {
    expect(toChangeEvent({ eventType: 'DELETE', new: {}, old: {} })).toBeNull()
  })
})
```

- [ ] **Step 2: position, validation 실패 테스트**

`src/lib/position.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { positionAfter, positionBetween } from './position'

describe('positionAfter', () => {
  it('starts at 1 for an empty list', () => {
    expect(positionAfter([])).toBe(1)
  })

  it('goes one past the largest position', () => {
    expect(positionAfter([3, 1.5, 2])).toBe(4)
  })
})

describe('positionBetween', () => {
  it('returns the midpoint of two neighbours', () => {
    expect(positionBetween(1, 2)).toBe(1.5)
  })

  it('goes before the first item', () => {
    expect(positionBetween(undefined, 1)).toBe(0)
  })

  it('goes after the last item', () => {
    expect(positionBetween(4, undefined)).toBe(5)
  })

  it('returns 1 with no neighbours', () => {
    expect(positionBetween()).toBe(1)
  })
})
```

`src/lib/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeTag, optionalUrlSchema, textSchema } from './validation'

describe('textSchema', () => {
  it('trims and requires at least one character', () => {
    expect(textSchema.parse('  hi  ')).toBe('hi')
    expect(textSchema.safeParse('   ').success).toBe(false)
  })
})

describe('optionalUrlSchema', () => {
  it('turns an empty string into null', () => {
    expect(optionalUrlSchema.parse('  ')).toBeNull()
  })

  it('accepts http and https URLs', () => {
    expect(optionalUrlSchema.parse('https://example.com/a')).toBe('https://example.com/a')
    expect(optionalUrlSchema.parse('http://example.com')).toBe('http://example.com')
  })

  it('rejects other schemes and non-URLs', () => {
    expect(optionalUrlSchema.safeParse('javascript:alert(1)').success).toBe(false)
    expect(optionalUrlSchema.safeParse('not a url').success).toBe(false)
  })
})

describe('normalizeTag', () => {
  it('strips leading # and whitespace', () => {
    expect(normalizeTag('  #storytime ')).toBe('storytime')
    expect(normalizeTag('##grwm')).toBe('grwm')
    expect(normalizeTag('day in my life')).toBe('dayinmylife')
  })

  it('returns an empty string for blank input', () => {
    expect(normalizeTag(' # ')).toBe('')
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- src/lib/realtime src/lib/position.test.ts src/lib/validation.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 4: 순수 함수 구현**

`src/lib/realtime/applyChange.ts`:

```ts
export type Row = { id: string }

export type ChangeEvent<T extends Row> =
  | { type: 'INSERT' | 'UPDATE'; row: T }
  | { type: 'DELETE'; id: string }

/** Supabase postgres_changes payload 중 우리가 쓰는 부분 */
export type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

/**
 * 목록에 변경 하나를 반영한다. INSERT/UPDATE는 id 기준 upsert라서
 * 낙관적으로 추가한 행의 실시간 에코가 와도 중복되지 않는다.
 * 목록에 없는 id의 DELETE는 같은 배열을 그대로 돌려준다(리렌더 없음).
 */
export function applyChange<T extends Row>(
  list: T[],
  event: ChangeEvent<T>,
  compare?: (a: T, b: T) => number,
): T[] {
  let next: T[]
  if (event.type === 'DELETE') {
    if (!list.some((r) => r.id === event.id)) return list
    next = list.filter((r) => r.id !== event.id)
  } else {
    const exists = list.some((r) => r.id === event.row.id)
    next = exists
      ? list.map((r) => (r.id === event.row.id ? event.row : r))
      : [...list, event.row]
  }
  return compare ? [...next].sort(compare) : next
}

/** event를 되돌리는 변경. 낙관적 업데이트 실패 시 롤백에 쓴다. */
export function inverseOf<T extends Row>(list: T[], event: ChangeEvent<T>): ChangeEvent<T> | null {
  if (event.type === 'DELETE') {
    const prev = list.find((r) => r.id === event.id)
    return prev ? { type: 'INSERT', row: prev } : null
  }
  const prev = list.find((r) => r.id === event.row.id)
  return prev ? { type: 'UPDATE', row: prev } : { type: 'DELETE', id: event.row.id }
}

export function toChangeEvent(payload: RealtimePayload): ChangeEvent<Row> | null {
  if (payload.eventType === 'DELETE') {
    const id = payload.old.id
    return typeof id === 'string' ? { type: 'DELETE', id } : null
  }
  return { type: payload.eventType, row: payload.new as Row }
}
```

`src/lib/position.ts`:

```ts
/** 목록 맨 끝에 놓일 position */
export function positionAfter(positions: number[]): number {
  return positions.length === 0 ? 1 : Math.max(...positions) + 1
}

/** 두 이웃 사이에 놓일 position. 다른 행의 position은 바꾸지 않는다. */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 1
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}
```

`src/lib/validation.ts`:

```ts
import { z } from 'zod'

export const textSchema = z.string().trim().min(1).max(500)

const httpUrl = z.url({ protocol: /^https?$/ })

/** 빈 값은 null, 값이 있으면 http(s) URL이어야 한다. */
export const optionalUrlSchema = z
  .string()
  .trim()
  .pipe(z.union([z.literal(''), httpUrl]))
  .transform((v) => (v === '' ? null : v))

/** "#day in my life" → "dayinmylife" */
export function normalizeTag(input: string): string {
  return input.trim().replace(/^#+/, '').replace(/\s+/g, '')
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test`
Expected: 전체 통과

- [ ] **Step 6: Realtime Provider**

`src/lib/realtime/WorkspaceRealtime.tsx`:

```tsx
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { WORKSPACE_TABLES, type LiveTable } from '@/lib/types'
import { toChangeEvent, type ChangeEvent, type RealtimePayload, type Row } from './applyChange'

type Handler = (event: ChangeEvent<Row>) => void

type RealtimeContextValue = {
  workspaceId: string
  /** 재연결될 때마다 1씩 증가 — 위젯이 데이터를 다시 조회하는 신호 */
  resyncKey: number
  subscribe: (table: LiveTable, handler: Handler) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

/**
 * 워크스페이스당 Realtime 채널 하나를 열고, 테이블별 변경을 구독한 위젯에 나눠 준다.
 * RLS가 적용되므로 본인 데이터 변경만 온다.
 */
export function WorkspaceRealtime({
  workspaceId,
  children,
}: {
  workspaceId: string
  children: ReactNode
}) {
  const handlers = useRef(new Map<LiveTable, Set<Handler>>())
  const [resyncKey, setResyncKey] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const dispatch =
      (table: LiveTable) => (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const event = toChangeEvent(payload as RealtimePayload)
        if (event) handlers.current.get(table)?.forEach((handle) => handle(event))
      }

    const channel = supabase.channel(`workspace:${workspaceId}`)
    const filter = `workspace_id=eq.${workspaceId}`
    for (const table of WORKSPACE_TABLES) {
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, dispatch(table))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, dispatch(table))
        // DELETE 이벤트에는 필터가 적용되지 않는다. 목록에 없는 id는 applyChange가 무시한다.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, dispatch(table))
    }
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` },
      dispatch('workspaces'),
    )

    let connectedOnce = false
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (connectedOnce) setResyncKey((k) => k + 1)
      connectedOnce = true
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [workspaceId])

  const subscribe = useCallback((table: LiveTable, handler: Handler) => {
    const map = handlers.current
    if (!map.has(table)) map.set(table, new Set())
    map.get(table)!.add(handler)
    return () => {
      map.get(table)?.delete(handler)
    }
  }, [])

  const value = useMemo(
    () => ({ workspaceId, resyncKey, subscribe }),
    [workspaceId, resyncKey, subscribe],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

function useRealtimeContext() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('WorkspaceRealtime provider is missing')
  return ctx
}

export function useWorkspaceId() {
  return useRealtimeContext().workspaceId
}

export function useResyncKey() {
  return useRealtimeContext().resyncKey
}

/** handler는 useCallback으로 고정해서 넘긴다. */
export function useRealtimeTable<T extends Row>(
  table: LiveTable,
  handler: (event: ChangeEvent<T>) => void,
) {
  const { subscribe } = useRealtimeContext()
  useEffect(() => subscribe(table, handler as Handler), [subscribe, table, handler])
}
```

- [ ] **Step 7: useLiveList, useAutosave**

`src/lib/realtime/useLiveList.ts`:

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkspaceTable } from '@/lib/types'
import { applyChange, inverseOf, type ChangeEvent, type Row } from './applyChange'
import { useRealtimeTable, useResyncKey, useWorkspaceId } from './WorkspaceRealtime'

export type WriteResult = { error: { message: string } | null }

/**
 * 서버에서 받은 초기 목록 + 낙관적 변경 + 실시간 변경을 하나의 상태로 관리한다.
 * compare는 모듈 최상단 상수로 넘겨서 참조가 바뀌지 않게 한다.
 */
export function useLiveList<T extends Row>(
  table: WorkspaceTable,
  initial: T[],
  compare?: (a: T, b: T) => number,
) {
  const workspaceId = useWorkspaceId()
  const [rows, setRows] = useState<T[]>(() => (compare ? [...initial].sort(compare) : initial))
  const [error, setError] = useState<string | null>(null)
  const rowsRef = useRef(rows)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  const onRemoteChange = useCallback(
    (event: ChangeEvent<T>) => setRows((cur) => applyChange(cur, event, compare)),
    [compare],
  )
  useRealtimeTable<T>(table, onRemoteChange)

  // 재연결되면 놓친 변경이 있을 수 있으니 한 번 다시 조회한다.
  const resyncKey = useResyncKey()
  useEffect(() => {
    if (resyncKey === 0) return
    let cancelled = false
    void createClient()
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId)
      .then(({ data }) => {
        if (cancelled || !data) return
        const fresh = data as T[]
        setRows(compare ? [...fresh].sort(compare) : fresh)
      })
    return () => {
      cancelled = true
    }
  }, [resyncKey, table, workspaceId, compare])

  /** 화면을 먼저 바꾸고 write()를 실행한다. 실패하면 되돌리고 false를 반환한다. */
  const mutate = useCallback(
    async (event: ChangeEvent<T>, write: () => PromiseLike<WriteResult>) => {
      const inverse = inverseOf(rowsRef.current, event)
      setRows((cur) => applyChange(cur, event, compare))
      setError(null)

      const { error: writeError } = await write()
      if (!writeError) return true

      if (inverse) setRows((cur) => applyChange(cur, inverse, compare))
      setError(writeError.message)
      return false
    },
    [compare],
  )

  return { rows, mutate, error }
}
```

`src/lib/realtime/useAutosave.ts`:

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/**
 * schedule(value)가 마지막으로 호출되고 delay(ms) 뒤에 save(value)를 한 번 실행한다.
 * flush()는 기다리지 않고 바로 저장한다(blur, 언마운트 시).
 */
export function useAutosave(save: (value: string) => Promise<boolean>, delay = 800) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<string | null>(null)
  const saveRef = useRef(save)

  useEffect(() => {
    saveRef.current = save
  })

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const value = pending.current
    if (value === null) return
    pending.current = null
    setStatus('saving')
    const ok = await saveRef.current(value)
    setStatus(pending.current !== null ? 'pending' : ok ? 'saved' : 'error')
  }, [])

  const schedule = useCallback(
    (value: string) => {
      pending.current = value
      setStatus('pending')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delay)
    },
    [delay, flush],
  )

  useEffect(
    () => () => {
      void flush()
    },
    [flush],
  )

  return { status, schedule, flush }
}
```

- [ ] **Step 8: tableData와 공용 컴포넌트**

`src/lib/tableData.ts`:

```ts
import { createClient } from '@/lib/supabase/client'
import type { Row } from '@/lib/realtime/applyChange'
import type { WorkspaceTable } from '@/lib/types'

/** 위젯 테이블 하나에 대한 브라우저 쓰기 함수. 권한은 RLS가 확인한다. */
export function tableData<T extends Row>(table: WorkspaceTable) {
  const from = () => createClient().from(table)
  return {
    insert: (row: T) => from().insert(row),
    update: (id: string, patch: Partial<T>) => from().update(patch).eq('id', id),
    remove: (id: string) => from().delete().eq('id', id),
  }
}
```

`src/components/WidgetCard.tsx`:

```tsx
import type { ReactNode } from 'react'

export function WidgetCard({
  title,
  error,
  children,
}: {
  title: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <section className="h-full rounded-lg border border-gray-300 p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {children}
    </section>
  )
}
```

`src/components/EditableText.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useAutosave } from '@/lib/realtime/useAutosave'

/**
 * 제자리 수정 입력칸. 입력을 멈추면 800ms 뒤 onSave, blur 시 즉시 저장한다.
 * 편집 중에는 바깥(실시간) 값으로 덮어쓰지 않는다.
 */
export function EditableText({
  value,
  onSave,
  label,
  className = '',
}: {
  value: string
  onSave: (value: string) => Promise<boolean>
  label: string
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)
  const [focused, setFocused] = useState(false)
  const { schedule, flush } = useAutosave(async (v) => {
    const text = v.trim()
    return text ? onSave(text) : false
  })

  // 편집 중이 아닐 때 바깥 값이 바뀌면 따라간다.
  if (!focused && value !== synced) {
    setSynced(value)
    setDraft(value)
  }

  return (
    <input
      aria-label={label}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        schedule(e.target.value)
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        void flush()
        if (!draft.trim()) setDraft(value)
      }}
      className={`min-w-0 rounded border border-transparent px-1 hover:border-gray-300 focus:border-gray-400 focus:outline-none ${className}`}
    />
  )
}
```

- [ ] **Step 9: 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 통과

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add optimistic list state, realtime provider, and autosave"
```

---

### Task 6: 앱 틀 — 헤더 탭, 대시보드 그리드, 설정 페이지(언어·워크스페이스 이름)

**Files:**
- Create: `src/lib/workspace.ts`, `src/lib/dashboard.ts`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/WorkspaceTabs.tsx`, `src/app/(app)/actions.ts`, `src/app/(app)/error.tsx`
- Create: `src/app/(app)/[platform]/page.tsx`
- Create: `src/app/(app)/[platform]/settings/page.tsx`
- Create: `src/features/settings/LanguageToggle.tsx`, `src/features/settings/WorkspaceNameForm.tsx`, `src/features/settings/actions.ts`

**Interfaces:**
- Consumes: `isPlatform`, `PLATFORMS`, 행 타입들, `createClient` (server), `WorkspaceRealtime`, `WidgetCard`, `EditableText`, `setLocale`, `LOCALES`
- Produces: `getWorkspace(platform: Platform): Promise<Workspace | null>` (React `cache`)
- Produces: `loadDashboard(workspaceId: string): Promise<DashboardData>`, `DashboardData = { schedule: ScheduleItem[]; checklist: ChecklistItem[]; kanban: KanbanCard[]; ideas: PinnedIdea[]; references: ReferenceItem[]; hashtags: Hashtag[] }`
- Produces: `renameWorkspace(id: string, name: string): Promise<ActionResult>`
- Produces: 대시보드 페이지의 위젯 자리(slot). Task 7~15가 `<WidgetCard title={t('<ns>.title')}>{null}</WidgetCard>` 한 줄을 실제 위젯으로 바꾼다.

- [ ] **Step 1: 워크스페이스·대시보드 조회**

`src/lib/workspace.ts`:

```ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Platform, Workspace } from '@/lib/types'

/** 현재 사용자의 해당 플랫폼 워크스페이스. RLS 덕분에 본인 것만 조회된다. */
export const getWorkspace = cache(async (platform: Platform): Promise<Workspace | null> => {
  const supabase = await createClient()
  const { data } = await supabase.from('workspaces').select('*').eq('platform', platform).maybeSingle()
  return data as Workspace | null
})
```

`src/lib/dashboard.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import type {
  ChecklistItem,
  Hashtag,
  KanbanCard,
  PinnedIdea,
  ReferenceItem,
  ScheduleItem,
  WorkspaceTable,
} from '@/lib/types'

export type DashboardData = {
  schedule: ScheduleItem[]
  checklist: ChecklistItem[]
  kanban: KanbanCard[]
  ideas: PinnedIdea[]
  references: ReferenceItem[]
  hashtags: Hashtag[]
}

export async function loadDashboard(workspaceId: string): Promise<DashboardData> {
  const supabase = await createClient()

  async function list<T>(table: WorkspaceTable): Promise<T[]> {
    const { data, error } = await supabase.from(table).select('*').eq('workspace_id', workspaceId)
    if (error) throw new Error(`${table}: ${error.message}`)
    return (data ?? []) as T[]
  }

  const [schedule, checklist, kanban, ideas, references, hashtags] = await Promise.all([
    list<ScheduleItem>('schedule_items'),
    list<ChecklistItem>('checklist_items'),
    list<KanbanCard>('kanban_cards'),
    list<PinnedIdea>('pinned_ideas'),
    list<ReferenceItem>('reference_items'),
    list<Hashtag>('hashtags'),
  ])
  return { schedule, checklist, kanban, ideas, references, hashtags }
}
```

- [ ] **Step 2: 헤더 레이아웃**

`src/app/(app)/actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

`src/app/(app)/WorkspaceTabs.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { isPlatform, PLATFORMS } from '@/lib/types'

export function WorkspaceTabs() {
  const t = useTranslations('nav')
  const current = usePathname().split('/')[1] ?? ''

  return (
    <nav className="flex items-center gap-2">
      {PLATFORMS.map((p) => (
        <Link
          key={p}
          href={`/${p}`}
          aria-current={current === p ? 'page' : undefined}
          className={`rounded px-3 py-1 text-sm ${
            current === p ? 'bg-gray-900 text-white' : 'border border-gray-300'
          }`}
        >
          {t(p)}
        </Link>
      ))}
      {isPlatform(current) && (
        <Link href={`/${current}/settings`} className="ml-2 text-sm underline">
          {t('settings')}
        </Link>
      )}
    </nav>
  )
}
```

`src/app/(app)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { signOut } from './actions'
import { WorkspaceTabs } from './WorkspaceTabs'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav')

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 pb-3">
        <WorkspaceTabs />
        <form action={signOut}>
          <button type="submit" className="text-sm underline">
            {t('logout')}
          </button>
        </form>
      </header>
      {children}
    </div>
  )
}
```

`src/app/(app)/error.tsx`:

```tsx
'use client'

import { useTranslations } from 'next-intl'

export default function AppError({ reset }: { reset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="p-8 text-center">
      <p className="mb-3">{t('loadFailed')}</p>
      <button type="button" onClick={reset} className="underline">
        {t('retry')}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 대시보드 페이지 (위젯 자리 포함)**

`src/app/(app)/[platform]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WidgetCard } from '@/components/WidgetCard'
import { loadDashboard } from '@/lib/dashboard'
import { WorkspaceRealtime } from '@/lib/realtime/WorkspaceRealtime'
import { isPlatform } from '@/lib/types'
import { getWorkspace } from '@/lib/workspace'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ platform: string }>
}) {
  const { platform } = await params
  if (!isPlatform(platform)) notFound()
  const workspace = await getWorkspace(platform)
  if (!workspace) notFound()

  const [data, t] = await Promise.all([loadDashboard(workspace.id), getTranslations()])
  const isYouTube = platform === 'youtube'

  return (
    // key: 탭을 바꾸면 위젯 상태를 새 워크스페이스로 완전히 초기화한다.
    <WorkspaceRealtime key={workspace.id} workspaceId={workspace.id}>
      <h1 className="mb-4 text-2xl font-bold">{workspace.name}</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* ── 오늘 할 일 ── */}
        <h2 className="text-lg font-semibold md:col-span-12">{t('dashboard.today')}</h2>
        <div className="md:col-span-7">
          <WidgetCard title={t('schedule.title')}>{null}</WidgetCard>
        </div>
        <div className="md:col-span-5">
          <WidgetCard title={t('checklist.title')}>{null}</WidgetCard>
        </div>
        <div className="md:col-span-12">
          <WidgetCard title={t('kanban.title')}>{null}</WidgetCard>
        </div>

        {/* ── 탐색 · 영감 ── */}
        <h2 className="mt-4 text-lg font-semibold md:col-span-12">{t('dashboard.explore')}</h2>
        {isYouTube && (
          <div className="md:col-span-8">
            <WidgetCard title={t('trends.title')}>{null}</WidgetCard>
          </div>
        )}
        <div className={isYouTube ? 'md:col-span-4' : 'md:col-span-6'}>
          <WidgetCard title={t('ideas.title')}>{null}</WidgetCard>
        </div>
        <div className="md:col-span-6">
          <WidgetCard title={t('references.title')}>{null}</WidgetCard>
        </div>
        <div className={isYouTube ? 'md:col-span-6' : 'md:col-span-4'}>
          <WidgetCard title={t('hashtags.title')}>{null}</WidgetCard>
        </div>
        <div className={isYouTube ? 'md:col-span-8' : 'md:col-span-4'}>
          <WidgetCard title={t('memo.title')}>{null}</WidgetCard>
        </div>
        <div className="md:col-span-4">
          <WidgetCard title={t('performance.title')}>
            <p className="text-sm text-gray-500">{t('performance.comingSoon')}</p>
          </WidgetCard>
        </div>
      </div>
    </WorkspaceRealtime>
  )
}
```

(`data`는 Task 7부터 사용한다. 이 시점의 lint 경고 `'data' is assigned a value but never used`는 Task 7에서 사라진다.)

- [ ] **Step 4: 설정 — 언어 토글, 워크스페이스 이름**

`src/features/settings/actions.ts`:

```ts
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
```

`src/features/settings/LanguageToggle.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { setLocale } from '@/i18n/actions'
import { LOCALES, type Locale } from '@/i18n/locale'

// 언어 이름은 각 언어로 표기하는 것이 관례라 번역하지 않는다.
const LABELS: Record<Locale, string> = { ko: '한국어', en: 'English' }

export function LanguageToggle() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div role="group" aria-label={t('language')} className="flex items-center gap-2">
      <span className="text-sm">{t('language')}</span>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={l === locale}
          onClick={() =>
            startTransition(async () => {
              await setLocale(l)
              router.refresh()
            })
          }
          className={`rounded px-3 py-1 text-sm ${
            l === locale ? 'bg-gray-900 text-white' : 'border border-gray-300'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  )
}
```

`src/features/settings/WorkspaceNameForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { renameWorkspace } from './actions'

export function WorkspaceNameForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const t = useTranslations()
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  async function save(value: string) {
    const result = await renameWorkspace(workspaceId, value)
    const ok = 'ok' in result
    setFailed(!ok)
    if (ok) router.refresh()
    return ok
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>{t('settings.workspaceName')}</span>
      <EditableText
        label={t('settings.workspaceName')}
        value={name}
        onSave={save}
        className="border-gray-300"
      />
      {failed && (
        <span role="alert" className="text-red-600">
          {t('common.saveFailed')}
        </span>
      )}
    </div>
  )
}
```

`src/app/(app)/[platform]/settings/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WidgetCard } from '@/components/WidgetCard'
import { LanguageToggle } from '@/features/settings/LanguageToggle'
import { WorkspaceNameForm } from '@/features/settings/WorkspaceNameForm'
import { WorkspaceRealtime } from '@/lib/realtime/WorkspaceRealtime'
import { isPlatform } from '@/lib/types'
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
      </div>
    </WorkspaceRealtime>
  )
}
```

- [ ] **Step 5: 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 테스트·타입 통과. lint는 `data` 미사용 경고 1건만 허용.

`npm run dev` 후 로그인해서 확인:
- `/youtube`: 헤더 탭(YouTube 선택됨), 위젯 제목 카드 9개(트렌드 포함), 성과 스냅샷에 "준비 중" 문구
- `/instagram`: 트렌드 카드 없음, 나머지 그리드가 12칸을 채움
- `/tiktok` → 404
- 설정 → English 클릭 → 헤더·설정 문구가 영어로 바뀜 → 새로고침해도 유지
- 설정 → 워크스페이스 이름 수정 → 대시보드 제목에 반영
- 로그아웃 → `/login`, 이후 `/youtube` 접근 시 `/login`으로 이동

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add workspace tabs, bento grid shell, and settings page"
```

---
### 위젯 태스크 공통 사항 (Task 7~13)

- 위젯의 순수 로직(목록 반영, 롤백, position, 검증)은 Task 5에서 단위 테스트를 마쳤다. 위젯 태스크는 **타입 체크 + lint + 실제 앱 확인**으로 검증한다.
- **실시간 확인 방법:** 같은 계정으로 브라우저 창 두 개에 `/youtube`를 열고, 한쪽에서 바꾼 내용이 다른 쪽에 새로고침 없이 1~2초 안에 나타나는지 본다.
- **롤백 확인 방법:** 개발자도구 Network 탭을 Offline으로 두고 항목을 추가하면, 잠깐 보였다가 사라지고 위젯에 저장 실패 문구가 뜬다.

---

### Task 7: 촬영 체크리스트 위젯

**Files:**
- Create: `src/features/checklist/data.ts`, `src/features/checklist/ChecklistWidget.tsx`
- Modify: `src/app/(app)/[platform]/page.tsx`

**Interfaces:**
- Consumes: `tableData`, `useLiveList`, `useWorkspaceId`, `positionAfter`, `positionBetween`, `textSchema`, `WidgetCard`, `EditableText`, `ChecklistItem`
- Produces: `<ChecklistWidget initial={ChecklistItem[]} />`

- [ ] **Step 1: data.ts**

`src/features/checklist/data.ts`:

```ts
import { tableData } from '@/lib/tableData'
import type { ChecklistItem } from '@/lib/types'

export const checklistData = tableData<ChecklistItem>('checklist_items')
```

- [ ] **Step 2: 위젯**

`src/features/checklist/ChecklistWidget.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { WidgetCard } from '@/components/WidgetCard'
import { positionAfter, positionBetween } from '@/lib/position'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { ChecklistItem } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { checklistData } from './data'

const byPosition = (a: ChecklistItem, b: ChecklistItem) => a.position - b.position

export function ChecklistWidget({ initial }: { initial: ChecklistItem[] }) {
  const t = useTranslations('checklist')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('checklist_items', initial, byPosition)
  const [content, setContent] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = textSchema.safeParse(content)
    if (!parsed.success) return
    const row: ChecklistItem = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      content: parsed.data,
      is_done: false,
      position: positionAfter(rows.map((r) => r.position)),
      created_at: new Date().toISOString(),
    }
    setContent('')
    void mutate({ type: 'INSERT', row }, () => checklistData.insert(row))
  }

  function update(row: ChecklistItem, patch: Partial<ChecklistItem>) {
    return mutate({ type: 'UPDATE', row: { ...row, ...patch } }, () =>
      checklistData.update(row.id, patch),
    )
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= rows.length) return
    const position =
      dir === -1
        ? positionBetween(rows[target - 1]?.position, rows[target].position)
        : positionBetween(rows[target].position, rows[target + 1]?.position)
    void update(rows[index], { position })
  }

  return (
    <WidgetCard title={t('title')} error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <input
          aria-label={t('itemLabel')}
          placeholder={t('itemLabel')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row, i) => (
            <li key={row.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={tc('done')}
                checked={row.is_done}
                onChange={(e) => void update(row, { is_done: e.target.checked })}
              />
              <EditableText
                label={t('itemLabel')}
                value={row.content}
                onSave={(v) => update(row, { content: v })}
                className={`flex-1 ${row.is_done ? 'text-gray-400 line-through' : ''}`}
              />
              <button
                type="button"
                aria-label={tc('moveUp')}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="px-1 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={tc('moveDown')}
                disabled={i === rows.length - 1}
                onClick={() => move(i, 1)}
                className="px-1 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() =>
                  void mutate({ type: 'DELETE', id: row.id }, () => checklistData.remove(row.id))
                }
                className="text-sm text-red-600"
              >
                {tc('delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
```

- [ ] **Step 3: 대시보드에 연결**

`src/app/(app)/[platform]/page.tsx`에 import 추가:

```tsx
import { ChecklistWidget } from '@/features/checklist/ChecklistWidget'
```

다음 줄을

```tsx
          <WidgetCard title={t('checklist.title')}>{null}</WidgetCard>
```

아래로 교체:

```tsx
          <ChecklistWidget initial={data.checklist} />
```

- [ ] **Step 4: 검증**

Run: `npm run typecheck && npm run lint`
Expected: 에러·경고 없음 (`data` 미사용 경고 해소)

앱에서: 추가 → 즉시 표시 / 체크 / 제목 수정 후 0.8초 뒤 저장(새로고침해도 유지) / ↑↓ 순서 변경 유지 / 삭제 / 창 두 개 실시간 반영 / Offline 롤백

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add shooting checklist widget"
```

---

### Task 8: 업로드 일정 위젯

**Files:**
- Create: `src/features/schedule/data.ts`, `src/features/schedule/ScheduleWidget.tsx`
- Modify: `src/app/(app)/[platform]/page.tsx`

**Interfaces:**
- Consumes: `tableData`, `useLiveList`, `useWorkspaceId`, `textSchema`, `WidgetCard`, `EditableText`, `ScheduleItem`, `SCHEDULE_KINDS`, `ScheduleKind`
- Produces: `<ScheduleWidget initial={ScheduleItem[]} />`

- [ ] **Step 1: data.ts**

`src/features/schedule/data.ts`:

```ts
import { tableData } from '@/lib/tableData'
import type { ScheduleItem } from '@/lib/types'

export const scheduleData = tableData<ScheduleItem>('schedule_items')
```

- [ ] **Step 2: 위젯**

`src/features/schedule/ScheduleWidget.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { WidgetCard } from '@/components/WidgetCard'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { SCHEDULE_KINDS, type ScheduleItem, type ScheduleKind } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { scheduleData } from './data'

// DB(+00:00)와 클라이언트(Z)의 ISO 표기가 달라 문자열이 아닌 시각으로 비교한다.
const byDate = (a: ScheduleItem, b: ScheduleItem) =>
  new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()

export function ScheduleWidget({ initial }: { initial: ScheduleItem[] }) {
  const t = useTranslations('schedule')
  const tc = useTranslations('common')
  const format = useFormatter()
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('schedule_items', initial, byDate)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ScheduleKind>('upload')
  const [when, setWhen] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = textSchema.safeParse(title)
    if (!parsed.success || !when) return
    const row: ScheduleItem = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      title: parsed.data,
      kind,
      // datetime-local 값은 브라우저 현지 시각 → UTC ISO로 저장
      scheduled_at: new Date(when).toISOString(),
      is_done: false,
      created_at: new Date().toISOString(),
    }
    setTitle('')
    setWhen('')
    void mutate({ type: 'INSERT', row }, () => scheduleData.insert(row))
  }

  function update(row: ScheduleItem, patch: Partial<ScheduleItem>) {
    return mutate({ type: 'UPDATE', row: { ...row, ...patch } }, () =>
      scheduleData.update(row.id, patch),
    )
  }

  return (
    <WidgetCard title={t('title')} error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
        <input
          aria-label={t('titleLabel')}
          placeholder={t('titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <select
          aria-label={t('kindLabel')}
          value={kind}
          onChange={(e) => setKind(e.target.value as ScheduleKind)}
          className="rounded border border-gray-300 px-2 py-1"
        >
          {SCHEDULE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          aria-label={t('whenLabel')}
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          required
          className="rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.id} className={`flex items-center gap-2 ${row.is_done ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                aria-label={tc('done')}
                checked={row.is_done}
                onChange={(e) => void update(row, { is_done: e.target.checked })}
              />
              <span className="rounded bg-gray-100 px-1 text-xs">{t(`kinds.${row.kind}`)}</span>
              <span className="shrink-0 text-xs text-gray-600">
                {format.dateTime(new Date(row.scheduled_at), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
              <EditableText
                label={t('titleLabel')}
                value={row.title}
                onSave={(v) => update(row, { title: v })}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() =>
                  void mutate({ type: 'DELETE', id: row.id }, () => scheduleData.remove(row.id))
                }
                className="text-sm text-red-600"
              >
                {tc('delete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
```

- [ ] **Step 3: 대시보드에 연결**

`src/app/(app)/[platform]/page.tsx`에 import 추가:

```tsx
import { ScheduleWidget } from '@/features/schedule/ScheduleWidget'
```

다음 줄을

```tsx
          <WidgetCard title={t('schedule.title')}>{null}</WidgetCard>
```

아래로 교체:

```tsx
          <ScheduleWidget initial={data.schedule} />
```

- [ ] **Step 4: 검증**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

앱에서: 날짜 순 정렬 / 종류 표시가 현재 언어로 / 날짜 표기가 언어 전환 시 바뀜 / 완료 체크 시 흐려짐 / 제목 인라인 수정 / 삭제 / 실시간 / 롤백

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add upload schedule widget"
```

---

### Task 9: 편집 진행 칸반 위젯

**Files:**
- Create: `src/features/kanban/data.ts`, `src/features/kanban/KanbanWidget.tsx`
- Modify: `src/app/(app)/[platform]/page.tsx`

**Interfaces:**
- Consumes: `tableData`, `useLiveList`, `useWorkspaceId`, `positionAfter`, `textSchema`, `WidgetCard`, `EditableText`, `KanbanCard`, `KANBAN_STATUSES`, `KanbanStatus`
- Produces: `<KanbanWidget initial={KanbanCard[]} />`

- [ ] **Step 1: data.ts**

`src/features/kanban/data.ts`:

```ts
import { tableData } from '@/lib/tableData'
import type { KanbanCard } from '@/lib/types'

export const kanbanData = tableData<KanbanCard>('kanban_cards')
```

- [ ] **Step 2: 위젯**

`src/features/kanban/KanbanWidget.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { WidgetCard } from '@/components/WidgetCard'
import { positionAfter } from '@/lib/position'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { KANBAN_STATUSES, type KanbanCard, type KanbanStatus } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { kanbanData } from './data'

const byPosition = (a: KanbanCard, b: KanbanCard) => a.position - b.position

export function KanbanWidget({ initial }: { initial: KanbanCard[] }) {
  const t = useTranslations('kanban')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('kanban_cards', initial, byPosition)
  const [title, setTitle] = useState('')

  const endOf = (status: KanbanStatus) =>
    positionAfter(rows.filter((r) => r.status === status).map((r) => r.position))

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = textSchema.safeParse(title)
    if (!parsed.success) return
    const row: KanbanCard = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      title: parsed.data,
      status: 'shot',
      position: endOf('shot'),
      created_at: new Date().toISOString(),
    }
    setTitle('')
    void mutate({ type: 'INSERT', row }, () => kanbanData.insert(row))
  }

  function update(card: KanbanCard, patch: Partial<KanbanCard>) {
    return mutate({ type: 'UPDATE', row: { ...card, ...patch } }, () =>
      kanbanData.update(card.id, patch),
    )
  }

  function shift(card: KanbanCard, dir: -1 | 1) {
    const target = KANBAN_STATUSES[KANBAN_STATUSES.indexOf(card.status) + dir]
    if (!target) return
    void update(card, { status: target, position: endOf(target) })
  }

  return (
    <WidgetCard title={t('title')} error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <input
          aria-label={t('cardLabel')}
          placeholder={t('cardLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {KANBAN_STATUSES.map((status, col) => {
          const cards = rows.filter((r) => r.status === status)
          return (
            <div key={status} className="rounded bg-gray-50 p-2">
              <h4 className="mb-2 text-sm font-medium">
                {t(`statuses.${status}`)} <span className="text-gray-500">{cards.length}</span>
              </h4>
              {cards.length === 0 ? (
                <p className="text-xs text-gray-400">{t('emptyColumn')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cards.map((card) => (
                    <li key={card.id} className="rounded border border-gray-300 bg-white p-2">
                      <EditableText
                        label={t('cardLabel')}
                        value={card.title}
                        onSave={(v) => update(card, { title: v })}
                        className="w-full text-sm"
                      />
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          aria-label={tc('moveLeft')}
                          disabled={col === 0}
                          onClick={() => shift(card, -1)}
                          className="px-1 disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label={tc('moveRight')}
                          disabled={col === KANBAN_STATUSES.length - 1}
                          onClick={() => shift(card, 1)}
                          className="px-1 disabled:opacity-30"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void mutate({ type: 'DELETE', id: card.id }, () =>
                              kanbanData.remove(card.id),
                            )
                          }
                          className="ml-auto text-red-600"
                        >
                          {tc('delete')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </WidgetCard>
  )
}
```

- [ ] **Step 3: 대시보드에 연결**

`src/app/(app)/[platform]/page.tsx`에 import 추가:

```tsx
import { KanbanWidget } from '@/features/kanban/KanbanWidget'
```

다음 줄을

```tsx
          <WidgetCard title={t('kanban.title')}>{null}</WidgetCard>
```

아래로 교체:

```tsx
          <KanbanWidget initial={data.kanban} />
```

- [ ] **Step 4: 검증**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

앱에서: 새 카드는 "촬영완료" 열 끝에 / → 로 다음 단계, 해당 열 끝에 붙음 / 첫 열 ← , 마지막 열 → 비활성 / 열별 개수 / 실시간 / 롤백

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add editing kanban widget"
```

---

### Task 10: 빠른 메모 위젯 (자동 저장 + 편집 중 보호)

**Files:**
- Create: `src/features/memo/data.ts`, `src/features/memo/MemoWidget.tsx`
- Modify: `src/app/(app)/[platform]/page.tsx`

**Interfaces:**
- Consumes: `useAutosave`, `useRealtimeTable`, `useWorkspaceId`, `createClient` (browser), `WidgetCard`, `Workspace`
- Produces: `saveMemo(workspaceId: string, memo: string): PromiseLike<{ error }>`, `<MemoWidget initialMemo={string} />`

- [ ] **Step 1: data.ts**

`src/features/memo/data.ts`:

```ts
import { createClient } from '@/lib/supabase/client'

export function saveMemo(workspaceId: string, memo: string) {
  return createClient().from('workspaces').update({ memo }).eq('id', workspaceId)
}
```

- [ ] **Step 2: 위젯**

`src/features/memo/MemoWidget.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { WidgetCard } from '@/components/WidgetCard'
import type { ChangeEvent } from '@/lib/realtime/applyChange'
import { useAutosave } from '@/lib/realtime/useAutosave'
import { useRealtimeTable, useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { Workspace } from '@/lib/types'
import { saveMemo } from './data'

export function MemoWidget({ initialMemo }: { initialMemo: string }) {
  const t = useTranslations('memo')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const [memo, setMemo] = useState(initialMemo)
  const [focused, setFocused] = useState(false)

  const { status, schedule, flush } = useAutosave(async (value) => {
    const { error } = await saveMemo(workspaceId, value)
    return !error
  })

  // 입력 중이거나 저장 대기 중이면 다른 기기의 변경으로 덮어쓰지 않는다.
  const protectedRef = useRef(false)
  useEffect(() => {
    protectedRef.current = focused || status === 'pending' || status === 'saving'
  }, [focused, status])

  const onRemoteChange = useCallback((event: ChangeEvent<Workspace>) => {
    if (event.type === 'UPDATE' && !protectedRef.current) setMemo(event.row.memo)
  }, [])
  useRealtimeTable<Workspace>('workspaces', onRemoteChange)

  const statusText =
    status === 'pending' || status === 'saving'
      ? tc('saving')
      : status === 'saved'
        ? tc('saved')
        : status === 'error'
          ? tc('saveFailed')
          : ''

  return (
    <WidgetCard title={t('title')}>
      <textarea
        aria-label={t('label')}
        placeholder={t('placeholder')}
        value={memo}
        rows={6}
        onChange={(e) => {
          setMemo(e.target.value)
          schedule(e.target.value)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          void flush()
        }}
        className="w-full rounded border border-gray-300 p-2 text-sm"
      />
      <p aria-live="polite" className="mt-1 h-4 text-xs text-gray-500">
        {statusText}
      </p>
    </WidgetCard>
  )
}
```

- [ ] **Step 3: 대시보드에 연결**

`src/app/(app)/[platform]/page.tsx`에 import 추가:

```tsx
import { MemoWidget } from '@/features/memo/MemoWidget'
```

다음 줄을

```tsx
          <WidgetCard title={t('memo.title')}>{null}</WidgetCard>
```

아래로 교체:

```tsx
          <MemoWidget initialMemo={workspace.memo} />
```

- [ ] **Step 4: 검증**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

앱에서: 입력 → "저장 중…" → 약 0.8초 뒤 "저장됨" / 새로고침해도 유지 / 창 A에서 입력 후 포커스를 빼면 창 B에 반영 / 창 B에서 입력 중일 때 창 A의 변경이 B의 입력을 덮지 않음 / YouTube와 Instagram 메모가 서로 독립

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add autosaving quick memo widget"
```

---

### Task 11: 해시태그 뱅크 위젯

**Files:**
- Create: `src/features/hashtags/data.ts`, `src/features/hashtags/HashtagsWidget.tsx`
- Modify: `src/app/(app)/[platform]/page.tsx`

**Interfaces:**
- Consumes: `tableData`, `useLiveList`, `useWorkspaceId`, `normalizeTag`, `WidgetCard`, `Hashtag`
- Produces: `<HashtagsWidget initial={Hashtag[]} />`

- [ ] **Step 1: data.ts**

`src/features/hashtags/data.ts`:

```ts
import { tableData } from '@/lib/tableData'
import type { Hashtag } from '@/lib/types'

export const hashtagsData = tableData<Hashtag>('hashtags')
```

- [ ] **Step 2: 위젯**

`src/features/hashtags/HashtagsWidget.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { WidgetCard } from '@/components/WidgetCard'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { Hashtag } from '@/lib/types'
import { normalizeTag } from '@/lib/validation'
import { hashtagsData } from './data'

const byTag = (a: Hashtag, b: Hashtag) => a.tag.localeCompare(b.tag)

export function HashtagsWidget({ initial }: { initial: Hashtag[] }) {
  const t = useTranslations('hashtags')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('hashtags', initial, byTag)
  const [tag, setTag] = useState('')
  const [group, setGroup] = useState('')
  const [duplicate, setDuplicate] = useState(false)

  function add(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizeTag(tag)
    if (!normalized || normalized.length > 100) return
    if (rows.some((r) => r.tag === normalized)) {
      setDuplicate(true)
      return
    }
    setDuplicate(false)
    const row: Hashtag = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      tag: normalized,
      group_name: group.trim() || null,
      created_at: new Date().toISOString(),
    }
    setTag('')
    void mutate({ type: 'INSERT', row }, () => hashtagsData.insert(row))
  }

  const groups = new Map<string, Hashtag[]>()
  for (const row of rows) {
    const key = row.group_name ?? ''
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const groupNames = [...groups.keys()].sort((a, b) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
  )

  return (
    <WidgetCard
      title={t('title')}
      error={duplicate ? t('duplicate') : error ? tc('saveFailed') : null}
    >
      <form onSubmit={add} className="mb-3 flex flex-wrap gap-2">
        <input
          aria-label={t('tagLabel')}
          placeholder={`#${t('tagLabel')}`}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <input
          aria-label={t('groupLabel')}
          placeholder={t('groupLabel')}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="w-32 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groupNames.map((name) => (
            <div key={name}>
              <h4 className="mb-1 text-xs font-medium text-gray-500">{name || t('ungrouped')}</h4>
              <ul className="flex flex-wrap gap-1">
                {groups.get(name)!.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-sm"
                  >
                    #{row.tag}
                    <button
                      type="button"
                      aria-label={`${tc('delete')} #${row.tag}`}
                      onClick={() =>
                        void mutate({ type: 'DELETE', id: row.id }, () => hashtagsData.remove(row.id))
                      }
                      className="text-gray-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
```

- [ ] **Step 3: 대시보드에 연결**

`src/app/(app)/[platform]/page.tsx`에 import 추가:

```tsx
import { HashtagsWidget } from '@/features/hashtags/HashtagsWidget'
```

다음 줄을

```tsx
          <WidgetCard title={t('hashtags.title')}>{null}</WidgetCard>
```

아래로 교체:

```tsx
          <HashtagsWidget initial={data.hashtags} />
```

- [ ] **Step 4: 검증**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

앱에서: `#Day in my life` 입력 → `#Dayinmylife`로 저장 / 같은 태그 재입력 시 중복 안내 / 그룹별 묶음, 그룹 없음은 맨 아래 / × 삭제 / 실시간

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add hashtag bank widget"
```

---

### Task 12: 레퍼런스 위젯

**Files:**
- Create: `src/features/references/data.ts`, `src/features/references/ReferencesWidget.tsx`
- Modify: `src/app/(app)/[platform]/page.tsx`

**Interfaces:**
- Consumes: `tableData`, `useLiveList`, `useWorkspaceId`, `textSchema`, `optionalUrlSchema`, `WidgetCard`, `EditableText`, `ReferenceItem`, `REFERENCE_KINDS`, `ReferenceKind`
- Produces: `<ReferencesWidget initial={ReferenceItem[]} />`

- [ ] **Step 1: data.ts**

`src/features/references/data.ts`:

```ts
import { tableData } from '@/lib/tableData'
import type { ReferenceItem } from '@/lib/types'

export const referencesData = tableData<ReferenceItem>('reference_items')
```

- [ ] **Step 2: 위젯**

`src/features/references/ReferencesWidget.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { WidgetCard } from '@/components/WidgetCard'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { REFERENCE_KINDS, type ReferenceItem, type ReferenceKind } from '@/lib/types'
import { optionalUrlSchema, textSchema } from '@/lib/validation'
import { referencesData } from './data'

const byNewest = (a: ReferenceItem, b: ReferenceItem) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

export function ReferencesWidget({ initial }: { initial: ReferenceItem[] }) {
  const t = useTranslations('references')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('reference_items', initial, byNewest)
  const [kind, setKind] = useState<ReferenceKind>('thumbnail')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [note, setNote] = useState('')
  const [invalidUrl, setInvalidUrl] = useState(false)

  function add(e: FormEvent) {
    e.preventDefault()
    const parsedTitle = textSchema.safeParse(title)
    if (!parsedTitle.success) return
    const parsedUrl = optionalUrlSchema.safeParse(url)
    const parsedImage = optionalUrlSchema.safeParse(imageUrl)
    if (!parsedUrl.success || !parsedImage.success) {
      setInvalidUrl(true)
      return
    }
    setInvalidUrl(false)
    const row: ReferenceItem = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      kind,
      title: parsedTitle.data,
      url: parsedUrl.data,
      image_url: parsedImage.data,
      note: note.trim(),
      created_at: new Date().toISOString(),
    }
    setTitle('')
    setUrl('')
    setImageUrl('')
    setNote('')
    void mutate({ type: 'INSERT', row }, () => referencesData.insert(row))
  }

  function update(row: ReferenceItem, patch: Partial<ReferenceItem>) {
    return mutate({ type: 'UPDATE', row: { ...row, ...patch } }, () =>
      referencesData.update(row.id, patch),
    )
  }

  const inputClass = 'min-w-0 rounded border border-gray-300 px-2 py-1'

  return (
    <WidgetCard
      title={t('title')}
      error={invalidUrl ? t('invalidUrl') : error ? tc('saveFailed') : null}
    >
      <form onSubmit={add} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          aria-label={t('kindLabel')}
          value={kind}
          onChange={(e) => setKind(e.target.value as ReferenceKind)}
          className={inputClass}
        >
          {REFERENCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
        <input aria-label={t('titleLabel')} placeholder={t('titleLabel')} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        <input aria-label={t('urlLabel')} placeholder={t('urlLabel')} value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} />
        <input aria-label={t('imageUrlLabel')} placeholder={t('imageUrlLabel')} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} />
        <input aria-label={t('noteLabel')} placeholder={t('noteLabel')} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} sm:col-span-2`} />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white sm:col-span-2">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 rounded border border-gray-300 p-2">
              {row.image_url && (
                // 외부 임의 도메인 이미지라 next/image 대신 img를 쓴다.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.image_url} alt="" className="h-28 w-full rounded object-cover" />
              )}
              <span className="w-fit rounded bg-gray-100 px-1 text-xs">{t(`kinds.${row.kind}`)}</span>
              <EditableText
                label={t('titleLabel')}
                value={row.title}
                onSave={(v) => update(row, { title: v })}
                className="text-sm font-medium"
              />
              {row.note && <p className="text-xs text-gray-600">{row.note}</p>}
              <div className="mt-auto flex items-center gap-2 text-sm">
                {row.url && (
                  <a href={row.url} target="_blank" rel="noreferrer" className="underline">
                    {t('open')}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    void mutate({ type: 'DELETE', id: row.id }, () => referencesData.remove(row.id))
                  }
                  className="ml-auto text-red-600"
                >
                  {tc('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
```

- [ ] **Step 3: 대시보드에 연결**

`src/app/(app)/[platform]/page.tsx`에 import 추가:

```tsx
import { ReferencesWidget } from '@/features/references/ReferencesWidget'
```

다음 줄을

```tsx
          <WidgetCard title={t('references.title')}>{null}</WidgetCard>
```

아래로 교체:

```tsx
          <ReferencesWidget initial={data.references} />
```

- [ ] **Step 4: 검증**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

앱에서: 제목만으로 추가 가능 / 이미지 URL 넣으면 미리보기 / `javascript:alert(1)` 링크는 거부되고 안내 표시 / 최신순 / 제목 인라인 수정 / 삭제 / 실시간

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add references widget"
```

---

### Task 13: 고정된 아이디어 위젯

**Files:**
- Create: `src/features/ideas/data.ts`, `src/features/ideas/PinnedIdeasWidget.tsx`
- Modify: `src/app/(app)/[platform]/page.tsx`

**Interfaces:**
- Consumes: `tableData`, `useLiveList`, `useWorkspaceId`, `textSchema`, `WidgetCard`, `EditableText`, `PinnedIdea`
- Produces: `ideasData` (`insert(row: PinnedIdea)` 등 — Task 15의 트렌드 pin이 사용), `<PinnedIdeasWidget initial={PinnedIdea[]} />`

- [ ] **Step 1: data.ts**

`src/features/ideas/data.ts`:

```ts
import { tableData } from '@/lib/tableData'
import type { PinnedIdea } from '@/lib/types'

export const ideasData = tableData<PinnedIdea>('pinned_ideas')
```

- [ ] **Step 2: 위젯**

`src/features/ideas/PinnedIdeasWidget.tsx`:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { WidgetCard } from '@/components/WidgetCard'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { PinnedIdea } from '@/lib/types'
import { textSchema } from '@/lib/validation'
import { ideasData } from './data'

const byNewest = (a: PinnedIdea, b: PinnedIdea) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

export function PinnedIdeasWidget({ initial }: { initial: PinnedIdea[] }) {
  const t = useTranslations('ideas')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('pinned_ideas', initial, byNewest)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = textSchema.safeParse(title)
    if (!parsed.success) return
    const row: PinnedIdea = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      title: parsed.data,
      note: note.trim(),
      source_url: null,
      thumbnail_url: null,
      created_at: new Date().toISOString(),
    }
    setTitle('')
    setNote('')
    void mutate({ type: 'INSERT', row }, () => ideasData.insert(row))
  }

  function update(row: PinnedIdea, patch: Partial<PinnedIdea>) {
    return mutate({ type: 'UPDATE', row: { ...row, ...patch } }, () =>
      ideasData.update(row.id, patch),
    )
  }

  return (
    <WidgetCard title={t('title')} error={error ? tc('saveFailed') : null}>
      <form onSubmit={add} className="mb-3 flex flex-col gap-2">
        <input
          aria-label={t('titleLabel')}
          placeholder={t('titleLabel')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        />
        <div className="flex gap-2">
          <input
            aria-label={t('noteLabel')}
            placeholder={t('noteLabel')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
          />
          <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
            {tc('add')}
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex gap-2 rounded border border-gray-300 p-2">
              {row.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.thumbnail_url} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <EditableText
                  label={t('titleLabel')}
                  value={row.title}
                  onSave={(v) => update(row, { title: v })}
                  className="text-sm font-medium"
                />
                {row.note && <p className="text-xs text-gray-600">{row.note}</p>}
                <div className="flex items-center gap-2 text-xs">
                  {row.source_url && (
                    <a href={row.source_url} target="_blank" rel="noreferrer" className="underline">
                      {t('source')}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void mutate({ type: 'DELETE', id: row.id }, () => ideasData.remove(row.id))
                    }
                    className="ml-auto text-red-600"
                  >
                    {tc('delete')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
```

- [ ] **Step 3: 대시보드에 연결**

`src/app/(app)/[platform]/page.tsx`에 import 추가:

```tsx
import { PinnedIdeasWidget } from '@/features/ideas/PinnedIdeasWidget'
```

다음 줄을

```tsx
          <WidgetCard title={t('ideas.title')}>{null}</WidgetCard>
```

아래로 교체:

```tsx
          <PinnedIdeasWidget initial={data.ideas} />
```

- [ ] **Step 4: 검증**

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

앱에서: 직접 추가(메모 선택) / 최신순 / 제목 인라인 수정 / 삭제 / 실시간

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add pinned ideas widget"
```

---
### Task 14: YouTube 트렌드 조회 함수

**Files:**
- Create: `src/lib/youtube/fetchTrends.ts`, `src/lib/youtube/videoUrl.ts`
- Test: `src/lib/youtube/fetchTrends.test.ts`

**Interfaces:**
- Produces: `TrendVideo = { videoId: string; title: string; channelTitle: string; viewCount: number; thumbnailUrl: string }`
- Produces: `fetchTrends(options: { apiKey: string; keywords: string[]; now: Date; limit?: number; fetchImpl?: typeof fetch }): Promise<TrendVideo[]>` — 조회수 내림차순, 기본 상위 8개
- Produces: `class YouTubeApiError extends Error { status: number }`
- Produces: `videoUrl(videoId: string): string`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/youtube/fetchTrends.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { fetchTrends, YouTubeApiError } from './fetchTrends'

const now = new Date('2026-09-28T00:00:00Z')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function video(id: string, views: string) {
  return {
    id,
    snippet: {
      title: `Title ${id}`,
      channelTitle: `Channel ${id}`,
      thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } },
    },
    statistics: { viewCount: views },
  }
}

/** search는 키워드별 결과, videos는 요청한 id만 돌려주는 가짜 fetch */
function fakeYouTube(search: Record<string, string[]>, videos: ReturnType<typeof video>[]) {
  const fn = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/search')) {
      const ids = search[url.searchParams.get('q') ?? ''] ?? []
      return json({ items: ids.map((videoId) => ({ id: { videoId } })) })
    }
    if (url.pathname.endsWith('/videos')) {
      const ids = (url.searchParams.get('id') ?? '').split(',')
      return json({ items: videos.filter((v) => ids.includes(v.id)) })
    }
    return json({}, 404)
  })
  return fn
}

const calls = (fn: ReturnType<typeof fakeYouTube>, path: string) =>
  fn.mock.calls.map(([input]) => new URL(String(input))).filter((u) => u.pathname.endsWith(path))

describe('fetchTrends', () => {
  it('returns [] without calling the API when there are no keywords', async () => {
    const fetchImpl = fakeYouTube({}, [])
    const result = await fetchTrends({ apiKey: 'k', keywords: [], now, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('searches each keyword with the niche filters', async () => {
    const fetchImpl = fakeYouTube({ storytelling: ['a'], 'raw story': ['b'] }, [video('a', '1'), video('b', '2')])
    await fetchTrends({ apiKey: 'k', keywords: ['storytelling', 'raw story'], now, fetchImpl: fetchImpl as unknown as typeof fetch })

    const searches = calls(fetchImpl, '/search')
    expect(searches.map((u) => u.searchParams.get('q'))).toEqual(['storytelling', 'raw story'])
    const p = searches[0].searchParams
    expect(p.get('part')).toBe('snippet')
    expect(p.get('type')).toBe('video')
    expect(p.get('relevanceLanguage')).toBe('en')
    expect(p.get('regionCode')).toBe('US')
    expect(p.get('order')).toBe('viewCount')
    expect(p.get('maxResults')).toBe('10')
    expect(p.get('publishedAfter')).toBe('2026-09-21T00:00:00.000Z')
    expect(p.get('key')).toBe('k')
  })

  it('dedupes video ids across keywords and looks them up in one call', async () => {
    const fetchImpl = fakeYouTube({ a: ['x', 'y'], b: ['y', 'z'] }, [video('x', '1'), video('y', '2'), video('z', '3')])
    await fetchTrends({ apiKey: 'k', keywords: ['a', 'b'], now, fetchImpl: fetchImpl as unknown as typeof fetch })

    const lookups = calls(fetchImpl, '/videos')
    expect(lookups).toHaveLength(1)
    expect(lookups[0].searchParams.get('id')!.split(',').sort()).toEqual(['x', 'y', 'z'])
    expect(lookups[0].searchParams.get('part')).toBe('snippet,statistics')
  })

  it('sorts by view count, limits the result, and maps fields', async () => {
    const fetchImpl = fakeYouTube({ q: ['a', 'b', 'c'] }, [video('a', '10'), video('b', '300'), video('c', '20')])
    const result = await fetchTrends({ apiKey: 'k', keywords: ['q'], now, limit: 2, fetchImpl: fetchImpl as unknown as typeof fetch })

    expect(result).toEqual([
      { videoId: 'b', title: 'Title b', channelTitle: 'Channel b', viewCount: 300, thumbnailUrl: 'https://i.ytimg.com/vi/b/mqdefault.jpg' },
      { videoId: 'c', title: 'Title c', channelTitle: 'Channel c', viewCount: 20, thumbnailUrl: 'https://i.ytimg.com/vi/c/mqdefault.jpg' },
    ])
  })

  it('skips the videos call when search finds nothing', async () => {
    const fetchImpl = fakeYouTube({}, [])
    const result = await fetchTrends({ apiKey: 'k', keywords: ['nothing'], now, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(result).toEqual([])
    expect(calls(fetchImpl, '/videos')).toHaveLength(0)
  })

  it('throws YouTubeApiError with the HTTP status on failure', async () => {
    const fetchImpl = vi.fn(async () => json({ error: { message: 'quotaExceeded' } }, 403))
    await expect(
      fetchTrends({ apiKey: 'k', keywords: ['q'], now, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ name: 'YouTubeApiError', status: 403 })
    await expect(
      fetchTrends({ apiKey: 'k', keywords: ['q'], now, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(YouTubeApiError)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/youtube`
Expected: FAIL — `./fetchTrends`를 찾을 수 없음

- [ ] **Step 3: 구현**

`src/lib/youtube/fetchTrends.ts`:

```ts
const API = 'https://www.googleapis.com/youtube/v3'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type TrendVideo = {
  videoId: string
  title: string
  channelTitle: string
  viewCount: number
  thumbnailUrl: string
}

export class YouTubeApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'YouTubeApiError'
    this.status = status
  }
}

type SearchResponse = { items?: { id?: { videoId?: string } }[] }
type VideosResponse = {
  items?: {
    id: string
    snippet: {
      title: string
      channelTitle: string
      thumbnails: Record<string, { url: string } | undefined>
    }
    statistics: { viewCount?: string }
  }[]
}

/**
 * 키워드마다 영어권 최근 7일 인기 영상을 검색하고, 조회수 상위 limit개를 돌려준다.
 * 할당량: search 100 units × 키워드 수 + videos 1 unit.
 */
export async function fetchTrends({
  apiKey,
  keywords,
  now,
  limit = 8,
  fetchImpl = fetch,
}: {
  apiKey: string
  keywords: string[]
  now: Date
  limit?: number
  fetchImpl?: typeof fetch
}): Promise<TrendVideo[]> {
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
        order: 'viewCount',
        publishedAfter,
        maxResults: '10',
        key: apiKey,
      })
      const data = await getJson<SearchResponse>(fetchImpl, `${API}/search?${params}`)
      return (data.items ?? []).map((item) => item.id?.videoId).filter((id): id is string => !!id)
    }),
  )

  const ids = [...new Set(idLists.flat())].slice(0, 50)
  if (ids.length === 0) return []

  // search 결과의 제목은 HTML 이스케이프되어 있어서 videos의 snippet을 쓴다.
  const params = new URLSearchParams({ part: 'snippet,statistics', id: ids.join(','), key: apiKey })
  const data = await getJson<VideosResponse>(fetchImpl, `${API}/videos?${params}`)

  return (data.items ?? [])
    .map((v) => ({
      videoId: v.id,
      title: v.snippet.title,
      channelTitle: v.snippet.channelTitle,
      viewCount: Number(v.statistics.viewCount ?? 0),
      thumbnailUrl: v.snippet.thumbnails.medium?.url ?? v.snippet.thumbnails.default?.url ?? '',
    }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit)
}

async function getJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const res = await fetchImpl(url, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text()
    throw new YouTubeApiError(res.status, body.slice(0, 300))
  }
  return (await res.json()) as T
}
```

`src/lib/youtube/videoUrl.ts`:

```ts
export function videoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/lib/youtube`
Expected: 6 passed

Run: `npm run typecheck && npm run lint`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add YouTube trending video fetcher"
```

---

### Task 15: 오늘의 트렌드 위젯 (조회·갱신·폴백·pin)

**Files:**
- Create: `src/lib/trends/getTodayTrends.ts`
- Create: `src/features/trends/TrendsSection.tsx`, `src/features/trends/TrendsWidget.tsx`
- Modify: `src/app/(app)/[platform]/page.tsx`

**Interfaces:**
- Consumes: `fetchTrends`, `videoUrl`, `seoulDateString`, `createClient` (server), `ideasData`, `useWorkspaceId`, `WidgetCard`, `TrendTopic`, `PinnedIdea`
- Produces: `TrendsResult = { status: 'ok'; topics: TrendTopic[] } | { status: 'no-keywords' } | { status: 'failed'; fallback: TrendTopic[]; fetchedOn: string | null }`
- Produces: `getTodayTrends(workspaceId: string): Promise<TrendsResult>` (서버 전용 — Task 16의 다시 가져오기 액션도 사용)
- Produces: `<TrendsSection workspaceId />` (async 서버 컴포넌트), `<TrendsWidget result pinnedUrls />`

- [ ] **Step 1: 오늘 트렌드 조회/갱신**

`src/lib/trends/getTodayTrends.ts`:

```ts
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import type { TrendTopic } from '@/lib/types'
import { fetchTrends } from '@/lib/youtube/fetchTrends'

export type TrendsResult =
  | { status: 'ok'; topics: TrendTopic[] }
  | { status: 'no-keywords' }
  | { status: 'failed'; fallback: TrendTopic[]; fetchedOn: string | null }

/**
 * 오늘(한국 시간) 저장된 트렌드가 있으면 그대로, 없으면 YouTube에서 가져와 저장한다.
 * 실패하면 아무것도 저장하지 않고 가장 최근 날짜의 트렌드를 폴백으로 돌려준다.
 */
export async function getTodayTrends(workspaceId: string): Promise<TrendsResult> {
  const supabase = await createClient()
  const today = seoulDateString(new Date())

  const todays = () =>
    supabase
      .from('trend_topics')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('fetched_on', today)
      .order('view_count', { ascending: false })

  const existing = await todays()
  if (existing.data && existing.data.length > 0) {
    return { status: 'ok', topics: existing.data as TrendTopic[] }
  }

  const { data: keywordRows } = await supabase
    .from('trend_keywords')
    .select('keyword')
    .eq('workspace_id', workspaceId)
  const keywords = (keywordRows ?? []).map((r) => r.keyword as string)
  if (keywords.length === 0) return { status: 'no-keywords' }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

    const videos = await fetchTrends({ apiKey, keywords, now: new Date() })
    if (videos.length > 0) {
      const { error } = await supabase.from('trend_topics').upsert(
        videos.map((v) => ({
          workspace_id: workspaceId,
          fetched_on: today,
          video_id: v.videoId,
          title: v.title,
          channel_title: v.channelTitle,
          view_count: v.viewCount,
          thumbnail_url: v.thumbnailUrl,
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
}
```

- [ ] **Step 2: 위젯**

`src/features/trends/TrendsWidget.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { WidgetCard } from '@/components/WidgetCard'
import { ideasData } from '@/features/ideas/data'
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
      id: crypto.randomUUID(),
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

  if (result.status === 'no-keywords') {
    return (
      <WidgetCard title={t('title')}>
        <p className="text-sm text-gray-600">
          {t('noKeywords')}{' '}
          <Link href="/youtube/settings" className="underline">
            {t('goToSettings')}
          </Link>
        </p>
      </WidgetCard>
    )
  }

  const topics = result.status === 'ok' ? result.topics : result.fallback

  return (
    <WidgetCard title={t('title')} error={pinFailed ? tc('saveFailed') : null}>
      {result.status === 'failed' && (
        <p role="status" className="mb-2 text-sm text-amber-700">
          {t('failed')} {result.fetchedOn && t('showingFrom', { date: result.fetchedOn })}
        </p>
      )}

      {topics.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {topics.map((topic) => {
            const url = videoUrl(topic.video_id)
            const isPinned = pinned.has(url)
            return (
              <li key={topic.id} className="flex gap-2">
                {topic.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={topic.thumbnail_url} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-2 text-sm font-medium hover:underline"
                  >
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
          })}
        </ul>
      )}
    </WidgetCard>
  )
}
```

`src/features/trends/TrendsSection.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getTodayTrends } from '@/lib/trends/getTodayTrends'
import { TrendsWidget } from './TrendsWidget'

/** Suspense 안에서 렌더링된다. YouTube 호출이 느려도 다른 위젯은 먼저 뜬다. */
export async function TrendsSection({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient()
  const [result, pinned] = await Promise.all([
    getTodayTrends(workspaceId),
    supabase
      .from('pinned_ideas')
      .select('source_url')
      .eq('workspace_id', workspaceId)
      .not('source_url', 'is', null),
  ])
  const pinnedUrls = (pinned.data ?? []).map((r) => r.source_url as string)
  return <TrendsWidget result={result} pinnedUrls={pinnedUrls} />
}
```

- [ ] **Step 3: 대시보드에 연결**

`src/app/(app)/[platform]/page.tsx`에 import 추가:

```tsx
import { Suspense } from 'react'
import { TrendsSection } from '@/features/trends/TrendsSection'
```

다음 줄을

```tsx
            <WidgetCard title={t('trends.title')}>{null}</WidgetCard>
```

아래로 교체:

```tsx
            <Suspense
              fallback={
                <WidgetCard title={t('trends.title')}>
                  <p className="text-sm text-gray-500">{t('trends.loading')}</p>
                </WidgetCard>
              }
            >
              <TrendsSection workspaceId={workspace.id} />
            </Suspense>
```

- [ ] **Step 4: 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 통과

`.env.local`에 `YOUTUBE_API_KEY`가 있는 상태에서 앱 확인:
- `/youtube` 첫 방문: 다른 위젯이 먼저 뜨고, 트렌드 자리에 "불러오는 중…" 후 영어 영상 카드 최대 8개(조회수 순)
- Supabase `trend_topics`에 오늘 날짜 행 생성 → 새로고침해도 YouTube를 다시 부르지 않음(서버 로그에 새 호출 없음)
- 고정 → 버튼이 "고정됨"으로 바뀌고, 고정된 아이디어 위젯에 썸네일·채널명과 함께 나타남 → 새로고침 후에도 "고정됨"
- `.env.local`에서 `YOUTUBE_API_KEY`를 잠시 지우고 오늘 행을 삭제한 뒤 새로고침: "트렌드를 불러오지 못했어요" + 이전 날짜 폴백(없으면 빈 안내). 확인 후 키 복구.
- `/instagram`에는 트렌드 위젯 없음

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add daily YouTube trend recommendations with pinning"
```

---

### Task 16: 설정 — 트렌드 키워드 관리 + 다시 가져오기

**Files:**
- Create: `src/features/trends/data.ts`, `src/features/trends/KeywordSettings.tsx`, `src/features/trends/actions.ts`
- Modify: `src/app/(app)/[platform]/settings/page.tsx` (전체 교체)

**Interfaces:**
- Consumes: `tableData`, `useLiveList`, `useWorkspaceId`, `getTodayTrends`, `seoulDateString`, `createClient` (server), `WidgetCard`, `TrendKeyword`, `ActionResult`
- Produces: `refetchTodayTrends(workspaceId: string): Promise<ActionResult>` (Server Action), `<KeywordSettings initial={TrendKeyword[]} />`

- [ ] **Step 1: 데이터와 Server Action**

`src/features/trends/data.ts`:

```ts
import { tableData } from '@/lib/tableData'
import type { TrendKeyword } from '@/lib/types'

export const keywordsData = tableData<TrendKeyword>('trend_keywords')
```

`src/features/trends/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { seoulDateString } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'
import { getTodayTrends } from '@/lib/trends/getTodayTrends'
import type { ActionResult } from '@/lib/types'

/** 오늘 저장된 트렌드를 지우고 현재 키워드로 다시 가져온다. */
export async function refetchTodayTrends(workspaceId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(workspaceId).success) return { error: 'invalid' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('trend_topics')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('fetched_on', seoulDateString(new Date()))
  if (error) return { error: error.message }

  const result = await getTodayTrends(workspaceId)
  revalidatePath('/youtube')
  return result.status === 'failed' ? { error: 'fetch-failed' } : { ok: true }
}
```

- [ ] **Step 2: 키워드 설정 컴포넌트**

`src/features/trends/KeywordSettings.tsx`:

```tsx
'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import type { TrendKeyword } from '@/lib/types'
import { refetchTodayTrends } from './actions'
import { keywordsData } from './data'

const byKeyword = (a: TrendKeyword, b: TrendKeyword) => a.keyword.localeCompare(b.keyword)

export function KeywordSettings({ initial }: { initial: TrendKeyword[] }) {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('trend_keywords', initial, byKeyword)
  const [keyword, setKeyword] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  const [refetchState, setRefetchState] = useState<'idle' | 'done' | 'failed'>('idle')
  const [refetching, startRefetch] = useTransition()

  function add(e: FormEvent) {
    e.preventDefault()
    const value = keyword.trim().replace(/\s+/g, ' ')
    if (!value || value.length > 60) return
    if (rows.some((r) => r.keyword.toLowerCase() === value.toLowerCase())) {
      setDuplicate(true)
      return
    }
    setDuplicate(false)
    const row: TrendKeyword = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      keyword: value,
      created_at: new Date().toISOString(),
    }
    setKeyword('')
    void mutate({ type: 'INSERT', row }, () => keywordsData.insert(row))
  }

  function refetch() {
    setRefetchState('idle')
    startRefetch(async () => {
      const result = await refetchTodayTrends(workspaceId)
      setRefetchState('ok' in result ? 'done' : 'failed')
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">{t('keywordsHelp')}</p>

      {(duplicate || error) && (
        <p role="alert" className="text-sm text-red-600">
          {duplicate ? t('keywordDuplicate') : tc('saveFailed')}
        </p>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input
          aria-label={t('keywordLabel')}
          placeholder={t('keywordLabel')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-white">
          {tc('add')}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('keywordsEmpty')}</p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {rows.map((row) => (
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
      )}

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
          {refetchState === 'done' && t('refetchDone')}
          {refetchState === 'failed' && <span className="text-red-600">{t('refetchFailed')}</span>}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 설정 페이지 전체 교체**

`src/app/(app)/[platform]/settings/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WidgetCard } from '@/components/WidgetCard'
import { LanguageToggle } from '@/features/settings/LanguageToggle'
import { WorkspaceNameForm } from '@/features/settings/WorkspaceNameForm'
import { KeywordSettings } from '@/features/trends/KeywordSettings'
import { WorkspaceRealtime } from '@/lib/realtime/WorkspaceRealtime'
import { createClient } from '@/lib/supabase/server'
import { isPlatform, type TrendKeyword } from '@/lib/types'
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
  if (platform === 'youtube') {
    const supabase = await createClient()
    const { data } = await supabase
      .from('trend_keywords')
      .select('*')
      .eq('workspace_id', workspace.id)
    keywords = (data ?? []) as TrendKeyword[]
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
          <WidgetCard title={t('trendKeywords')}>
            <KeywordSettings initial={keywords} />
          </WidgetCard>
        )}
      </div>
    </WorkspaceRealtime>
  )
}
```

- [ ] **Step 4: 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 통과

앱에서:
- `/youtube/settings`: 기본 키워드 3개(`authentic`, `raw story`, `storytelling`) 표시
- 키워드 추가/삭제 즉시 반영, 대소문자만 다른 중복은 거부
- "오늘 트렌드 다시 가져오기" → "새로 가져왔어요" → `/youtube`에서 새 키워드 기준 결과
- 키워드를 모두 지우면 대시보드 트렌드 위젯에 "설정에서 추가하기" 링크(오늘 데이터가 없을 때)
- `/instagram/settings`: 키워드 섹션 없음

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add trend keyword settings with manual refetch"
```

---

### Task 17: README 설정 가이드 + 전체 검증

**Files:**
- Modify: `README.md` (전체 교체)

- [ ] **Step 1: README 작성**

`README.md`:

````markdown
# 크리에이터 대시보드

유튜브·인스타그램 크리에이터를 위한 올인원 대시보드 (기능 뼈대 단계).

- 설계: `docs/superpowers/specs/2026-09-28-creator-dashboard-foundation-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-28-creator-dashboard-foundation.md`

## 준비물 (모두 무료)

| 항목 | 용도 |
|---|---|
| Node.js 20 이상 | 개발 서버 |
| Supabase 프로젝트 (무료 플랜) | DB, 로그인, 실시간 동기화 |
| Google Cloud 프로젝트 | YouTube Data API 키, 구글 로그인 |

## 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다.
2. **SQL Editor**에서 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 실행한다.
3. 이어서 `supabase/tests/rls_check.sql`을 실행해 결과가 `RLS OK`인지 확인한다.
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs에 `http://localhost:3000/auth/callback` 추가
5. **Project Settings → API**에서 Project URL과 anon(public) key를 복사해 둔다.

## 2. YouTube Data API 키

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만든다.
2. **APIs & Services → Library**에서 "YouTube Data API v3"를 사용 설정한다.
3. **APIs & Services → Credentials → Create credentials → API key**로 키를 만든다.
4. 키 제한(API restrictions)을 "YouTube Data API v3"로 걸어 둔다.

하루 무료 할당량은 10,000 units이고, 이 앱은 사용자당 하루 약 300 units를 쓴다. 결제 정보는 필요 없다.

## 3. 구글 로그인 (선택)

1. Google Cloud Console → **APIs & Services → OAuth consent screen**을 설정한다 (External, 테스트 사용자에 본인 이메일 추가).
2. **Credentials → Create credentials → OAuth client ID** → Web application
   - Authorized redirect URIs: `https://<프로젝트-ref>.supabase.co/auth/v1/callback`
     (Supabase의 Authentication → Sign In / Providers → Google 화면에 정확한 주소가 표시된다)
3. 발급된 Client ID와 Client Secret을 Supabase의 Google provider에 입력하고 활성화한다.

## 4. 실행

```bash
cp .env.example .env.local   # 값 세 개를 채운다
npm install
npm run dev
```

http://localhost:3000 → 회원가입 → YouTube 대시보드.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run typecheck` | 타입 체크 |
| `npm run lint` | ESLint |
````

- [ ] **Step 2: 자동 검증 전체 실행**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 테스트 전부 통과, 타입·lint 에러 없음, 빌드 성공

- [ ] **Step 3: 수동 체크리스트 (실제 앱)**

`npm run dev`로 띄우고 스펙 11장의 체크리스트를 순서대로 확인한다.

1. 새 계정 회원가입 → Supabase에서 `workspaces` 2행 + `trend_keywords` 3행 확인
2. 위젯별 추가/수정/삭제가 즉시 화면에 보임 (체크리스트, 일정, 칸반, 아이디어, 레퍼런스, 해시태그)
3. 창 두 개를 열어 한쪽 변경이 다른 쪽에 새로고침 없이 반영됨 (위젯마다 한 번씩)
4. 메모 자동 저장 ("저장 중…" → "저장됨"), 새로고침 후 유지
5. 트렌드 영상 표시 → 고정 → 고정된 아이디어에 나타남
6. 설정에서 키워드 변경 → 다시 가져오기 → 대시보드에 반영
7. 언어 토글 → 모든 위젯·헤더·설정 문구가 전환되고 새로고침 후에도 유지
8. YouTube ↔ Instagram 탭 전환 시 데이터가 워크스페이스별로 분리됨
9. 로그아웃 → `/youtube` 접근 시 `/login`으로 이동
10. 모바일 폭(375px)에서 위젯이 1열로 쌓임

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add setup guide for Supabase, YouTube API, and Google OAuth"
```
