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
- Supabase 클라우드 프로젝트 (Postgres + Auth), `@supabase/supabase-js`, `@supabase/ssr`
- 데이터 변경: Next.js Server Actions에서 Supabase 직접 호출 (별도 REST API 없음)
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
| `checklist_items` | `content text`, `is_done bool default false`, `position int` | |
| `kanban_cards` | `title text`, `status text` (`shot`\|`editing`\|`review`\|`uploaded`), `position int` | |
| `trend_keywords` | `keyword text` | `unique(workspace_id, keyword)` |
| `trend_topics` | `fetched_on date`, `video_id text`, `title text`, `channel_title text`, `view_count bigint`, `thumbnail_url text` | `unique(workspace_id, fetched_on, video_id)`. URL은 `video_id`로 생성 |
| `pinned_ideas` | `title text`, `note text`, `source_url text null`, `thumbnail_url text null` | 트렌드에서 pin 시 값 복사 (트렌드 행과 FK 연결 없음) |
| `reference_items` | `kind text` (`thumbnail`\|`topic`\|`sound`\|`font`\|`other`), `title text`, `url text null`, `image_url text null`, `note text` | `references`는 SQL 예약어라 이 이름을 사용 |
| `hashtags` | `tag text`, `group_name text null` | `unique(workspace_id, tag)` |

enum 성격 컬럼은 `check` 제약으로 값을 제한한다.

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
| `/youtube/settings` | 트렌드 키워드 추가/삭제, "오늘 트렌드 다시 가져오기", 워크스페이스 이름 변경 |
| `/instagram/settings` | 워크스페이스 이름 변경 |

`[platform]`이 `youtube`/`instagram`이 아니면 `notFound()`.

### 인증
- 미들웨어(Next.js 버전에 따라 `middleware.ts` 또는 `proxy.ts`)가 `@supabase/ssr`로 매 요청 세션을 갱신하고, 비로그인 사용자를 `/login`, `/auth/*` 외 경로에서 `/login`으로 보낸다.
- 서버 컴포넌트와 Server Action에서도 `supabase.auth.getUser()`로 재확인한다. 실제 데이터 보호는 RLS가 담당한다.
- 로그아웃: 헤더 버튼 → Server Action `signOut()` → `/login`.
- 구글 OAuth 설정(Google Cloud Console OAuth 클라이언트 생성, Supabase 대시보드에 Client ID/Secret 등록, 리다이렉트 URL 등록)은 사용자가 직접 하며, 절차를 README에 정리한다.

## 5. 폴더 구조

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
  features/                      # 위젯 하나 = 폴더 하나
    schedule/   {actions.ts, ScheduleWidget.tsx}
    checklist/  {actions.ts, ChecklistWidget.tsx}
    kanban/     {actions.ts, KanbanWidget.tsx}
    trends/     {actions.ts, TrendsWidget.tsx, KeywordSettings.tsx}
    ideas/      {actions.ts, PinnedIdeasWidget.tsx}
    references/ {actions.ts, ReferencesWidget.tsx}
    hashtags/   {actions.ts, HashtagsWidget.tsx}
    memo/       {actions.ts, MemoWidget.tsx}
supabase/migrations/0001_init.sql
supabase/tests/rls_check.sql
```

위젯 폴더끼리는 서로 import하지 않는다. 예외는 트렌드 위젯의 pin 동작이 `ideas/actions.ts`의 아이디어 생성 액션을 호출하는 것 하나다.

## 6. 대시보드 레이아웃 (구조만)

12칸 그리드, 위젯마다 `col-span`을 다르게 준다.

- **상단 — 오늘 할 일:** 업로드 일정(넓게), 촬영 체크리스트, 편집 칸반 요약
- **하단 — 탐색/영감:** 오늘의 트렌드(유튜브만), 고정된 아이디어, 최근 레퍼런스, 성과 스냅샷(준비 중), 해시태그 뱅크, 빠른 메모
- 인스타 워크스페이스에서는 트렌드 칸을 빼고 나머지 위젯이 그 자리를 채운다.
- 모바일 폭에서는 1열로 쌓는다.

## 7. 트렌드 추천

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

## 8. 에러 처리

- **YouTube 실패** (키 없음, 할당량 초과, 네트워크): 트렌드 위젯에 "트렌드를 불러오지 못했어요"를 표시하고, 가장 최근 날짜의 저장된 주제가 있으면 대신 보여준다. 실패 시 아무것도 저장하지 않아 다음 방문 때 재시도된다.
- **Server Action:** zod로 입력을 검증하고 `{ ok: true } | { error: string }`를 반환한다. 에러는 해당 위젯 안에 짧게 표시한다. 성공 시 `revalidatePath`로 대시보드를 갱신한다.
- **인증 실패:** 로그인·회원가입 폼에 Supabase 에러 메시지를 한국어로 매핑해 표시한다.

## 9. 테스트와 검증

- **Vitest:** `fetchTrends` (fetch 모킹: 파싱, 중복 제거, 정렬, 상위 N, HTTP 에러 전파), `dates.ts` (자정 전후 한국 날짜)
- **RLS:** `supabase/tests/rls_check.sql` — 두 사용자로 서로의 행을 읽기/쓰기 불가한지 확인
- **수동 체크리스트 (실제 앱 실행):** 회원가입 → 워크스페이스 2개 + 기본 키워드 생성 확인 → 위젯별 추가/수정/삭제 → 트렌드 표시와 pin → 키워드 변경 후 다시 가져오기 → 탭 전환 → 로그아웃 후 보호 경로 접근 차단
