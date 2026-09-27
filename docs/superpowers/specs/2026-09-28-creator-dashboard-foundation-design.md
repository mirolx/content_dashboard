# 크리에이터 대시보드 — 서브프로젝트 1: 기능 뼈대 설계

- 작성일: 2026-09-28
- 원본 스펙: 「콘텐츠 크리에이터 대시보드 — 프로젝트 스펙」(2026-09-28, @miro)
- 상태: 설계 승인됨, 구현 계획 작성 전

## 1. 목표와 범위

유튜브·인스타그램 크리에이터용 올인원 대시보드의 **기능 뼈대**를 만든다. 원본 스펙의 작업 순서 ①(디자인 없이 기능 먼저)에 해당한다.

### 포함
- Next.js 프로젝트 새로 스캐폴딩 (원본 스펙의 "완료" 항목은 실제로 존재하지 않아 처음부터 진행)
- Supabase 스키마 마이그레이션 + RLS
- 인증: 이메일/비밀번호 + 구글 OAuth, 보호된 라우트
- 유튜브 / 인스타그램 워크스페이스 전환
- 대시보드 위젯 CRUD: 업로드 일정, 촬영 체크리스트, 편집 칸반, 트렌드 추천(유튜브 전용), 고정 아이디어, 레퍼런스, 해시태그 뱅크, 빠른 메모
- 트렌드 검색 키워드 설정 (추가/삭제)
- 한국어/영어 UI, 설정 페이지의 언어 토글
- 즉시 반영(낙관적 업데이트 + 자동 저장)과 기기·탭 간 실시간 동기화(Supabase Realtime)
- 벤토 그리드 **레이아웃 구조**만 (기본 Tailwind, 디자인 없음)

### 제외 (이후 서브프로젝트)
- 디자인 시스템 및 플랫폼별 톤 차별화
- 성과 분석 — 대시보드의 "성과 스냅샷" 위젯은 "준비 중" 자리표시만 둔다
- Claude API로 트렌드에서 주제 추출/요약
- 인스타그램 트렌드 추천 (인스타 워크스페이스에는 트렌드 위젯 없음)
- 레퍼런스 파일 업로드(Supabase Storage) — 이번엔 URL만 저장
- 수익 관리, 스크립트 작성, 알림, 협업, 외부 스토리지 연동, 크론 기반 트렌드 갱신

## 2. 기술 스택

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase 클라우드 프로젝트 (Postgres + Auth + Realtime), `@supabase/supabase-js`, `@supabase/ssr`
- 초기 데이터 읽기: 서버 컴포넌트에서 Supabase 조회 후 위젯에 전달
- 위젯 데이터 변경: 클라이언트 컴포넌트에서 브라우저용 Supabase 클라이언트로 직접 호출 (RLS가 권한 보호). 별도 REST API 없음
- 서버 전용 작업(트렌드 갱신, 언어 저장, 로그아웃, 워크스페이스 이름 변경): Server Actions
- 다국어: `next-intl` (URL 접두사 없는 쿠키 기반)
- 입력 검증: zod
- 테스트: Vitest
- 외부 API: YouTube Data API v3

### 환경변수 (`.env.local`, 값은 사용자가 직접 입력)
| 이름 | 용도 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 브라우저 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | 브라우저 |
| `YOUTUBE_API_KEY` | YouTube Data API 키 | 서버 전용 |

`.env.example`에 이름만 적어 커밋하고, `.env.local`은 `.gitignore`에 포함한다.

## 3. 데이터 모델

### 공통 규칙
- 모든 테이블: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `created_at timestamptz default now()`
- 워크스페이스 소속 테이블: `workspace_id uuid not null references workspaces on delete cascade`
- RLS: 모든 테이블에서 활성화. select/insert/update/delete 모두 `user_id = auth.uid()` 조건
- insert 시 `workspace_id`가 본인 워크스페이스인지도 정책에서 확인 (`exists (select 1 from workspaces w where w.id = workspace_id and w.user_id = auth.uid())`)

### 테이블
| 테이블 | 컬럼 (공통 제외) | 제약/비고 |
|---|---|---|
| `workspaces` | `platform text` (`youtube`\|`instagram`), `name text`, `memo text default ''` | `unique(user_id, platform)`. `memo`는 빠른 메모 위젯용 |
| `schedule_items` | `title text`, `kind text` (`shoot`\|`edit`\|`upload`), `scheduled_at timestamptz`, `is_done bool default false` | |
| `checklist_items` | `content text`, `is_done bool default false`, `position double precision` | |
| `kanban_cards` | `title text`, `status text` (`shot`\|`editing`\|`review`\|`uploaded`), `position double precision` | |
| `trend_keywords` | `keyword text` | `unique(workspace_id, keyword)` |
| `trend_topics` | `fetched_on date`, `video_id text`, `title text`, `channel_title text`, `view_count bigint`, `thumbnail_url text` | `unique(workspace_id, fetched_on, video_id)`. URL은 `video_id`로 생성 |
| `pinned_ideas` | `title text`, `note text`, `source_url text null`, `thumbnail_url text null` | 트렌드에서 pin 시 값 복사 (트렌드 행과 FK 연결 없음) |
| `reference_items` | `kind text` (`thumbnail`\|`topic`\|`sound`\|`font`\|`other`), `title text`, `url text null`, `image_url text null`, `note text` | `references`는 SQL 예약어라 이 이름을 사용 |
| `hashtags` | `tag text`, `group_name text null` | `unique(workspace_id, tag)` |

enum 성격 컬럼은 `check` 제약으로 값을 제한한다.

`position`은 실수형이라, 두 항목 사이로 옮길 때 앞뒤 값의 중간값만 저장하면 된다(다른 행을 다시 번호 매기지 않음).

위젯 테이블 전부와 `workspaces`는 `supabase_realtime` publication에 추가한다.

### 가입 시 초기 데이터
`auth.users` insert 트리거(`security definer`)가 다음을 만든다.
- `workspaces` 2개: `youtube`("YouTube"), `instagram`("Instagram")
- 유튜브 워크스페이스의 `trend_keywords` 기본값: `storytelling`, `authentic`, `raw story`

## 4. 라우팅과 인증

### 라우트
| 경로 | 역할 |
|---|---|
| `/login` | 이메일/비밀번호 로그인·회원가입(탭 전환), "Google로 계속하기" |
| `/auth/callback` | OAuth·이메일 인증 코드 교환 → 세션 생성 → `/youtube`로 이동 |
| `/` | 로그인 상태면 `/youtube`, 아니면 `/login`으로 이동 |
| `/youtube`, `/instagram` | 대시보드. 헤더 탭이 두 URL을 오가는 링크 |
| `/youtube/settings` | 언어 토글, 트렌드 키워드 추가/삭제, "오늘 트렌드 다시 가져오기", 워크스페이스 이름 변경 |
| `/instagram/settings` | 언어 토글, 워크스페이스 이름 변경 |

`[platform]`이 `youtube`/`instagram`이 아니면 `notFound()`.

### 인증
- 미들웨어(Next.js 버전에 따라 `middleware.ts` 또는 `proxy.ts`)가 `@supabase/ssr`로 매 요청 세션을 갱신하고, 비로그인 사용자를 `/login`, `/auth/*` 외 경로에서 `/login`으로 보낸다.
- 서버 컴포넌트와 Server Action에서도 `supabase.auth.getUser()`로 재확인한다. 실제 데이터 보호는 RLS가 담당한다.
- 로그아웃: 헤더 버튼 → Server Action `signOut()` → `/login`.
- 구글 OAuth 설정(Google Cloud Console OAuth 클라이언트 생성, Supabase 대시보드에 Client ID/Secret 등록, 리다이렉트 URL 등록)은 사용자가 직접 하며, 절차를 README에 정리한다.

## 5. 다국어 (한국어 / English)

- `next-intl`을 URL 라우팅 없이 사용한다. 현재 언어는 `NEXT_LOCALE` 쿠키(`ko`|`en`)로 결정한다.
- UI 문구는 `messages/ko.json`, `messages/en.json`에 둔다. 두 파일의 키 구성이 같은지 테스트로 확인한다.
- **설정 토글:** 두 워크스페이스 설정 페이지 모두에 "계정" 영역을 두고 한국어/English 토글을 넣는다. 언어는 계정 단위라 워크스페이스와 무관하다.
- **저장:** 토글 → Server Action이 쿠키를 설정하고 `auth.updateUser({ data: { locale } })`로 사용자 메타데이터에도 저장 → 화면 새로 렌더링.
- **다른 기기에서 로그인:** `/auth/callback`과 로그인 액션이 사용자 메타데이터의 `locale`을 읽어 쿠키를 설정한다.
- **기본값:** 쿠키가 없으면 `Accept-Language`에 한국어가 있으면 `ko`, 아니면 `en`.
- 날짜·숫자 표기(조회수 등)도 현재 언어로 포맷한다. 트렌드 날짜 기준은 언어와 관계없이 Asia/Seoul이다.
- 사용자 입력 데이터와 YouTube 영상 제목은 번역하지 않는다.

## 6. 즉시 반영과 실시간 동기화

### 즉시 반영 (낙관적 업데이트)
- 위젯은 서버에서 받은 초기 목록을 로컬 상태로 들고 있는 클라이언트 컴포넌트다.
- 추가·수정·삭제·체크·칸반 이동은 로컬 상태를 먼저 바꾸고, 그 다음 Supabase에 쓴다.
- 새 행의 `id`는 클라이언트에서 `crypto.randomUUID()`로 만든다. 그래서 화면에 먼저 그린 항목과 나중에 도착하는 실시간 이벤트를 같은 `id`로 맞출 수 있다.
- 쓰기가 실패하면 변경 전 상태로 되돌리고 위젯 안에 에러를 표시한다.
- **자동 저장:** 빠른 메모와 텍스트 인라인 수정은 저장 버튼 없이, 입력이 멈추고 800ms 뒤에 저장한다. 저장 중/저장됨 상태를 작게 표시한다.

### 실시간 동기화 (Supabase Realtime)
- 대시보드는 워크스페이스당 채널 하나(`workspace:<id>`)를 열고, 위젯 테이블들의 `postgres_changes`를 `workspace_id=eq.<id>` 필터로 구독한다. RLS가 적용되므로 본인 데이터만 온다.
- 이벤트는 순수 함수 `applyChange(list, event)`로 로컬 목록에 반영한다.
  - INSERT/UPDATE: `id` 기준 upsert (내가 방금 만든 변경이 되돌아와도 중복되지 않음)
  - DELETE: `id`로 제거. DELETE 이벤트는 필터가 적용되지 않아 다른 워크스페이스의 `id`가 올 수 있지만, 목록에 없는 `id`이므로 무시된다.
- **동시 수정:** 마지막에 저장된 값이 이긴다(last write wins).
- **메모 편집 중 보호:** 메모 입력란이 포커스 중이거나 저장 대기 중이면 원격 변경으로 덮어쓰지 않는다.
- **재연결:** 오프라인 등으로 채널이 끊겼다가 다시 연결되면 위젯 데이터를 한 번 다시 조회한다.
- **트렌드:** `trend_topics`는 실시간 구독하지 않는다. 대신 `pinned_ideas`는 구독해서 다른 기기의 pin이 바로 보인다.

## 7. 폴더 구조

```
src/
  app/
    login/page.tsx
    auth/callback/route.ts
    (app)/
      layout.tsx                 # 헤더: 워크스페이스 탭 + 로그아웃
      [platform]/page.tsx        # 벤토 그리드 대시보드
      [platform]/settings/page.tsx
  lib/
    supabase/{client,server,middleware}.ts
    youtube/fetchTrends.ts       # 순수 함수: (apiKey, keywords, now) → 영상 목록
    trends/refreshTrends.ts      # 오늘 트렌드 조회/갱신 (DB + fetchTrends)
    dates.ts                     # 한국 시간 기준 오늘 날짜
    workspace.ts                 # platform → 현재 사용자 workspace 조회
    realtime/
      applyChange.ts             # 순수 함수: 목록 + 이벤트 → 새 목록
      WorkspaceRealtime.tsx      # 채널 구독 Provider, 테이블별 이벤트 배포
      useLiveList.ts             # 초기 목록 + 낙관적 변경 + 실시간 반영 + 롤백
      useAutosave.ts             # 800ms 디바운스 자동 저장
  i18n/
    request.ts                   # next-intl: 쿠키 → locale, messages 로드
    actions.ts                   # setLocale Server Action
  features/                      # 위젯 하나 = 폴더 하나
    schedule/   {data.ts, ScheduleWidget.tsx}
    checklist/  {data.ts, ChecklistWidget.tsx}
    kanban/     {data.ts, KanbanWidget.tsx}
    trends/     {actions.ts, TrendsWidget.tsx, KeywordSettings.tsx}
    ideas/      {data.ts, PinnedIdeasWidget.tsx}
    references/ {data.ts, ReferencesWidget.tsx}
    hashtags/   {data.ts, HashtagsWidget.tsx}
    memo/       {data.ts, MemoWidget.tsx}
    settings/   {LanguageToggle.tsx, WorkspaceNameForm.tsx}
messages/{ko,en}.json
supabase/migrations/0001_init.sql
supabase/tests/rls_check.sql
```

`data.ts`는 해당 위젯의 브라우저 Supabase 호출(insert/update/delete)을 모아둔 파일이다. 위젯 폴더끼리는 서로 import하지 않는다. 예외는 트렌드 위젯의 pin 동작이 `ideas/data.ts`의 아이디어 생성 함수를 호출하는 것 하나다.

## 8. 대시보드 레이아웃 (구조만)

12칸 그리드, 위젯마다 `col-span`을 다르게 준다.

- **상단 — 오늘 할 일:** 업로드 일정(넓게), 촬영 체크리스트, 편집 칸반 요약
- **하단 — 탐색/영감:** 오늘의 트렌드(유튜브만), 고정된 아이디어, 최근 레퍼런스, 성과 스냅샷(준비 중), 해시태그 뱅크, 빠른 메모
- 인스타 워크스페이스에서는 트렌드 칸을 빼고 나머지 위젯이 그 자리를 채운다.
- 모바일 폭에서는 1열로 쌓는다.

## 9. 트렌드 추천

### 데이터 소스
YouTube Data API v3, 영어권 "yapping"/스토리텔링 니치.

### 갱신 흐름 (`/youtube` 접속 시, 서버)
1. `today` = Asia/Seoul 기준 날짜. `trend_topics`에서 `(workspace_id, fetched_on = today)` 조회 → 있으면 반환.
2. 없으면 `refreshTrends`:
   1. 워크스페이스의 `trend_keywords` 조회. 0개면 "설정에서 키워드를 추가하세요" 안내를 표시하고 종료.
   2. 키워드마다 `search.list`: `part=snippet, type=video, q=<keyword>, relevanceLanguage=en, regionCode=US, order=viewCount, publishedAfter=<now-7일>, maxResults=10`
   3. 영상 ID 중복 제거 후 `videos.list`(`part=snippet,statistics`) 1회 호출 (최대 50개)
   4. `viewCount` 내림차순 상위 8개를 `insert ... on conflict do nothing`
3. 트렌드 위젯만 `<Suspense>`로 감싸 YouTube 호출이 다른 위젯 렌더링을 막지 않게 한다.

### 사용자 동작
- 카드: 썸네일, 제목, 채널명, 조회수, YouTube 링크
- **Pin:** 해당 영상 정보로 `pinned_ideas` 행 생성 → 고정된 아이디어 위젯에 표시
- **설정 페이지:** 키워드 추가/삭제. "오늘 트렌드 다시 가져오기"는 오늘 날짜 `trend_topics`를 지우고 `refreshTrends`를 다시 실행한다. 할당량 보호를 위해 대시보드에는 이 버튼을 두지 않는다.

### 할당량
`search.list` 100 units × 키워드 수 + `videos.list` 1 unit. 기본 키워드 3개 기준 사용자당 하루 약 301 units (무료 할당 10,000 units/일).

## 10. 에러 처리

- **YouTube 실패** (키 없음, 할당량 초과, 네트워크): 트렌드 위젯에 "트렌드를 불러오지 못했어요"를 표시하고, 가장 최근 날짜의 저장된 주제가 있으면 대신 보여준다. 실패 시 아무것도 저장하지 않아 다음 방문 때 재시도된다.
- **위젯 쓰기 실패:** 낙관적 변경을 롤백하고 위젯 안에 짧은 에러를 표시한다. 입력은 zod로 먼저 검증해서 빈 제목 등은 요청 전에 막는다.
- **Server Action:** `{ ok: true } | { error: string }`를 반환한다.
- **인증 실패:** 로그인·회원가입 폼에 Supabase 에러 메시지를 현재 언어로 매핑해 표시한다.
- 모든 에러 문구는 `messages/{ko,en}.json`에 둔다.

## 11. 테스트와 검증

- **Vitest**
  - `fetchTrends`: fetch 모킹으로 파싱, 중복 제거, 정렬, 상위 N, HTTP 에러 전파
  - `dates.ts`: 자정 전후 한국 날짜
  - `applyChange`: insert/update upsert, 중복 이벤트, 목록에 없는 id 삭제 무시, 정렬 유지
  - `useLiveList`의 롤백 로직 (상태 계산을 순수 함수로 분리해 테스트)
  - 메시지 파일: `ko.json`과 `en.json`의 키 구성이 같은지
- **RLS:** `supabase/tests/rls_check.sql` — 두 사용자로 서로의 행을 읽기/쓰기 불가한지 확인
- **수동 체크리스트 (실제 앱 실행):** 회원가입 → 워크스페이스 2개 + 기본 키워드 생성 확인 → 위젯별 추가/수정/삭제가 즉시 보이는지 → 창 두 개를 열어 한쪽 변경이 다른 쪽에 실시간 반영되는지 → 메모 자동 저장 → 트렌드 표시와 pin → 키워드 변경 후 다시 가져오기 → 언어 토글 후 전체 UI 전환 → 탭 전환 → 로그아웃 후 보호 경로 접근 차단
