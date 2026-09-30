# 크리에이터 대시보드

유튜브·인스타그램 크리에이터를 위한 올인원 대시보드. 촬영·편집·업로드 일정, 아이디어, 레퍼런스, 해시태그를 한 화면의 벤토 그리드에서 관리하고, 내 니치에 맞는 YouTube 트렌드 영상을 매일 추천받는다.

**🔗 배포:** https://content-dashboard1.vercel.app · **🌐 [English](#english)**

<p align="center">
  <img src="docs/images/dashboard-youtube.png" alt="YouTube 워크스페이스 대시보드 — 더스티 로즈 포인트" width="820">
</p>

<table>
  <tr>
    <td width="50%"><img src="docs/images/dashboard-instagram.png" alt="Instagram 워크스페이스 — 더스티 라벤더 포인트"></td>
    <td width="50%"><img src="docs/images/login.png" alt="로그인 화면"></td>
  </tr>
  <tr>
    <td align="center">Instagram 워크스페이스 (더스티 라벤더)</td>
    <td align="center">로그인</td>
  </tr>
</table>

## 주요 기능

### 워크스페이스
- **YouTube / Instagram 워크스페이스** 전환 — 탭을 바꾸면 데이터와 포인트 색(더스티 로즈 ↔ 더스티 라벤더)이 함께 바뀐다.
- **한국어 / English** UI 전환, 이메일·비밀번호 및 구글 로그인.

### 오늘 할 일
- **업로드 일정** — 촬영·편집·업로드 일정과 완료 체크
- **체크리스트** — 순서 변경, 인라인 수정
- **편집 진행 상태** — 촬영완료 → 편집중 → 검수중 → 업로드완료 칸반. 카드마다 **Notion 페이지를 연결**해 두고 클릭 한 번으로 대본·기획 페이지를 연다

### 탐색 · 영감
- **오늘의 트렌드 추천** (YouTube)
  - 📺 **벤치마킹 채널** — 등록한 채널의 최근 30일 인기 영상 (채널당 최대 2개)
  - 🔍 **키워드 추천** — 그룹별 키워드 풀(최대 100개)을 매일 로테이션해 OR 검색
  - 제목·태그·설명에 겹치는 키워드 수로 **관련도 순위**를 매기고, 맞은 키워드를 태그로 표시
  - 3분 이하 숏츠와 니치 밖 카테고리는 제외, 마음에 드는 영상은 아이디어로 **고정**
- **고정된 아이디어 · 레퍼런스 · 해시태그 뱅크 · 빠른 메모**

### 사용 경험
- **즉시 반영 + 실시간 동기화** — 입력은 바로 화면에 반영되고 실패하면 되돌아가며, 다른 탭·기기에도 새로고침 없이 반영된다.
- **자동 저장** — 메모와 인라인 수정은 입력을 멈추면 저장된다.
- **마그네틱 커서** — 탭과 버튼에 커서를 대면 커서가 버튼 모양으로 감싸고 버튼이 살짝 끌려온다 (터치 기기·동작 줄이기 설정에서는 꺼짐).

## UI 레이아웃

**다크 프레임 벤토 그리드.** 따뜻한 검정 배경 위에 크림 · 포인트 · 다크 세 가지 카드를 섞어 리듬을 만든다. 데스크톱은 12칸 그리드, 모바일(768px 미만)은 1열로 쌓인다.

| 구역 | 왼쪽 | 오른쪽 |
|---|---|---|
| 헤더 | 알약 탭: YouTube · Instagram · 설정 | 로그아웃 |
| 제목 | 워크스페이스 이름 (큰 글씨) | |
| **오늘 할 일** | 업로드 일정 — 7칸 · cream | 체크리스트 — 5칸 · accent |
| | 편집 진행 상태 — 12칸 · dark (촬영완료 · 편집중 · 검수중 · 업로드완료) | |
| **탐색 · 영감** | 오늘의 트렌드 — 8칸 · cream (📺 채널 / 🔍 키워드) | 고정된 아이디어 — 4칸 · dark |
| | 최근 레퍼런스 — 6칸 · dark | 해시태그 뱅크 — 6칸 · dark |
| | 빠른 메모 — 8칸 · cream | 성과 스냅샷 — 4칸 · accent |
| 푸터 | 글꼴 출처 표시 | |


### 디자인 토큰

| 토큰 | 값 | 용도 |
|---|---|---|
| `ink` | `#1C1818` | 페이지 배경, 밝은 카드 위 글자 |
| `panel` | `#262020` | 다크 카드 |
| `line` | `#3A3131` | 다크 카드 테두리 |
| `cream` | `#F6EFEB` | 크림 카드, 어두운 배경 위 글자 |
| `muted` | `#A89A96` | 보조 글자 |
| `accent` | YouTube `#D4A5A5` · Instagram `#B5A5D4` | 포인트 (탭에 따라 자동 전환) |
| `danger` | `#E07A6F` | 삭제 · 에러 |

- 글꼴: 세종글꽃체 (한글 · 영문 공통), 제목은 굵게 · 자간 좁게
- 모양: 카드 모서리 20px, 버튼 · 탭 · 태그는 알약형, 카드 간격 8px
- 공용 컴포넌트: `Card`(cream · accent · dark), `Button`(primary · ink · ghost · danger), `IconButton`, `PillTabs`, `Tag`, 입력 필드 클래스 — `src/components/ui/`

## 모션 · 인터랙션

### 마그네틱 커서
[21st.dev의 Fluid Magnetic Cursor](https://21st.dev/@jahed/components/magnetic-cursor)를 바탕으로 다시 구현했다 (`src/components/ui/magnetic-cursor.tsx`, gsap).

| 동작 | 설명 |
|---|---|
| 따라다니기 | 원형 커서가 마우스를 부드럽게 따라온다 (lerp 0.1). 시스템 커서는 그대로 보인다 |
| 늘어남 | 빠르게 움직이면 이동 방향으로 늘어나고 회전한다 |
| 색 반전 | `mix-blend-mode: exclusion` + 대비 보정으로 밝은 카드 · 어두운 배경 어디서든 보인다 |
| 달라붙기 | 탭 · 버튼에 올리면 커서가 그 요소 모양(여백 포함)으로 변해 감싼다 |
| 끌어당김 | 호버한 요소가 커서 쪽으로 살짝 끌려오고(강도 0.35), 떠나면 탄성 있게 제자리로 돌아간다 |

- 적용 대상: `data-magnetic`이 붙은 요소 — 헤더 알약 탭, `Button`, 트렌드 고정 버튼, 트렌드 설정 화살표.
- 제외: 입력칸, 체크박스, 작은 아이콘 버튼(이동 · 삭제), 비활성 버튼.
- 이벤트 위임 방식이라 나중에 나타난 버튼도 동작하고, 호버 중인 버튼이 사라져도(추가 · 페이지 이동) 커서가 멈추지 않는다.
- 마우스가 없는 기기(`hover: hover`·`pointer: fine`이 아님)에서는 꺼진다. 터치스크린 노트북에서 마우스를 쓰면 켜진다.
- **동작 줄이기**(`prefers-reduced-motion`) 설정에서는 지연 · 늘어남 · 끌어당김 · 모양 변형 없이 원형 커서만 따라간다.

### 그 밖의 인터랙션
- **낙관적 업데이트:** 추가 · 수정 · 삭제 · 체크 · 칸반 이동이 서버 응답 전에 바로 보이고, 저장에 실패하면 바꾼 필드만 되돌린다.
- **실시간 동기화:** 다른 탭 · 기기에서 바꾼 내용이 새로고침 없이 나타난다 (Supabase Realtime).
- **자동 저장:** 메모와 인라인 수정은 입력을 멈추고 0.8초 뒤 저장, "저장 중… / 저장됨" 표시.
- **호버 · 포커스:** 버튼은 색만 부드럽게 전환(`transition-colors`, 커서 끌어당김과 충돌하지 않도록), 키보드 포커스에는 외곽선 링이 보인다.

## 기술 스택

| 영역 | 사용 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript |
| 스타일 | Tailwind CSS 4 (`@theme` 토큰), lucide-react, 세종글꽃체 |
| 백엔드 | Supabase — Postgres + RLS, Auth, Realtime |
| 외부 API | YouTube Data API v3 |
| 기타 | next-intl (ko/en), zod, gsap (마그네틱 커서) |
| 테스트 | Vitest (138개) |
| 배포 | Vercel |

## 시작하기

### 준비물 

| 항목 | 용도 |
|---|---|
| Node.js 22.12 이상 (권장 24) | 개발 서버 |
| Supabase 프로젝트 (무료 플랜) | DB, 로그인, 실시간 동기화 |
| Google Cloud 프로젝트 | YouTube Data API 키, 구글 로그인 |

### 1. Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만든다.
2. **SQL Editor**에서 마이그레이션을 **순서대로 한 번씩** 실행한다.
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_trend_sources.sql`
   3. `supabase/migrations/0003_keyword_pool.sql`
   4. `supabase/migrations/0004_kanban_notion_links.sql`

   이미 운영 중인 프로젝트를 업데이트할 때는 새 코드를 배포하기 **전에** 새 마이그레이션을 먼저 실행한다. 순서가 바뀌면 실시간 동기화와 트렌드 조회가 실패한다.
3. `supabase/tests/rls_check.sql`을 실행해 결과가 `RLS OK`인지 확인한다.
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (배포 후에는 배포 주소)
   - Redirect URLs: `http://localhost:3000/auth/callback` (배포 후 `https://<배포 주소>/auth/callback` 추가)
5. **Project Settings → API**에서 Project URL과 anon(public) key를 복사해 둔다.

### 2. YouTube Data API 키

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만든다.
2. **APIs & Services → Library**에서 "YouTube Data API v3"를 사용 설정한다.
3. **APIs & Services → Credentials → Create credentials → API key**로 키를 만든다.
4. 키 제한(API restrictions)을 "YouTube Data API v3"로 걸어 둔다.

하루 무료 할당량은 10,000 units. 트렌드를 한 번 가져올 때 약 430 units를 쓴다 (가장 오래 쓰지 않은 키워드 그룹 4개 × 검색 100 units + 벤치마킹 채널 최대 10개 + 영상 상세 조회). "오늘 트렌드 다시 가져오기"도 한 번에 같은 양을 쓴다. 결제 정보는 필요 없다.

### 3. 구글 로그인 (선택)

1. Google Cloud Console → **APIs & Services → OAuth consent screen**을 설정한다 (External, 테스트 사용자에 본인 이메일 추가).
2. **Credentials → Create credentials → OAuth client ID** → Web application
   - Authorized redirect URIs: `https://<프로젝트-ref>.supabase.co/auth/v1/callback`
     (Supabase의 Authentication → Sign In / Providers → Google 화면에 정확한 주소가 표시된다)
3. 발급된 Client ID와 Client Secret을 Supabase의 Google provider에 입력하고 활성화한다.

### 4. 로컬 실행

```bash
cp .env.example .env.local   # 값 세 개를 채운다
npm install
npm run dev
```

http://localhost:3000 → 회원가입 → YouTube 대시보드.

| 환경변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon(public) key |
| `YOUTUBE_API_KEY` | YouTube Data API 키 (서버 전용, 절대 공개하지 않는다) |

### 5. Vercel 배포

1. Vercel에서 이 GitHub 저장소를 Import 한다 (Framework: Next.js).
2. **Environment Variables**에 위 세 값을 넣는다 (Production and Preview). `YOUTUBE_API_KEY`는 Sensitive로 표시한다.
3. 배포 후 Supabase의 Site URL과 Redirect URLs에 배포 주소를 추가한다 (1-4 참고).
4. 이후 `main`에 push하면 자동으로 다시 배포된다.

### 폰에서 테스트하기 (로컬)

1. PC와 폰을 같은 Wi-Fi에 연결하고 `npm run dev -- -H 0.0.0.0`으로 실행한다.
2. 폰 브라우저에서 `http://<PC의 내부 IP>:3000`으로 접속한다 (Windows: `ipconfig`).
3. Supabase Redirect URLs에 `http://<PC의 내부 IP>:3000/auth/callback`을 추가한다.
4. `next.config.ts`의 `allowedDevOrigins` 주석을 풀고 **PC의 내부 IP**를 넣는다 (Next.js 16 개발 서버는 localhost가 아닌 주소의 HMR 요청을 막는다. 커밋하지 않아도 된다).
5. 이메일 확인 링크는 Site URL을 가리키므로 **회원가입과 이메일 확인은 PC에서** 하고, 폰에서는 **로그인만** 한다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run typecheck` | 타입 체크 |
| `npm run lint` | ESLint |
| `npm run build` | 프로덕션 빌드 |

## 프로젝트 구조

```
src/
  app/                 # 라우트 (로그인, /youtube, /instagram, 설정, 인증 콜백)
  components/ui/       # Card, Button, PillTabs, Tag, 필드, 마그네틱 커서
  features/            # 위젯별 UI + 데이터 (schedule, checklist, kanban, trends …)
  lib/
    realtime/          # 낙관적 업데이트, Realtime 구독, 자동 저장
    trends/            # 로테이션, OR 검색어, 관련도 점수, 4+4 합치기
    youtube/           # YouTube API 호출 (가짜 fetch로 테스트)
  i18n/                # next-intl 설정, 언어 저장
messages/              # ko.json / en.json
supabase/              # 마이그레이션, RLS 검증 스크립트
docs/superpowers/      # 설계 스펙과 구현 계획
```

설계 문서는 [`docs/superpowers/specs`](docs/superpowers/specs), 구현 계획은 [`docs/superpowers/plans`](docs/superpowers/plans)에 있다.

## 글꼴 라이선스

한글·영문 글꼴은 **세종글꽃체**(`src/app/fonts/SejongGeulggot.ttf`)를 사용한다.

- 저작권: 세종특별자치시 (공공저작물, 문화체육관광부 「공공저작물 저작권 관리 및 이용 지침」에 따라 무료 사용)
- 조건: 유료 양도·판매 금지, 변형 재배포 금지 → 이 저장소에는 **받은 원본 TTF를 수정 없이** 포함한다 (형식 변환·서브셋 금지).
- 출처 표시: 누리집 사용 시 저작권자를 밝혀야 하므로 모든 화면 하단에 "이 사이트는 세종특별자치시의 세종글꽃체를 사용합니다."를 표시한다.
- 참고: https://noonnu.cc/font_page/1523

---

<a id="english"></a>

# Creator Dashboard (English)

An all-in-one dashboard for YouTube and Instagram creators. Manage shoot, edit, and upload schedules, ideas, references, and hashtags on a single bento-grid page, and get daily YouTube trend picks tuned to your niche.

**🔗 Live:** https://content-dashboard1.vercel.app

Screenshots are at the [top of this page](#크리에이터-대시보드).

## Features

### Workspaces
- **YouTube / Instagram workspaces** — switching tabs swaps both the data and the accent color (dusty rose ↔ dusty lavender).
- **Korean / English** UI toggle, email/password and Google sign-in.

### Today
- **Upload schedule** — shoot/edit/upload items with done checkboxes
- **Checklist** — reorder and edit inline
- **Editing progress** — kanban: Shot → Editing → In review → Uploaded. Each card can **link a Notion page** so its script/plan opens in one click

### Explore & inspiration
- **Today's trending topics** (YouTube)
  - 📺 **Benchmark channels** — the most-viewed videos from your chosen channels in the last 30 days (max 2 per channel)
  - 🔍 **Keyword picks** — a grouped keyword pool (up to 100) rotated daily into OR searches
  - Ranked by **relevance** (how many of your keywords appear in the title, tags, and description), with the matched keywords shown as tags
  - Shorts (3 minutes or less) and off-niche categories are skipped; pin any video as an idea
- **Pinned ideas · References · Hashtag bank · Quick notes**

### Experience
- **Instant updates + realtime sync** — changes appear immediately, roll back on failure, and show up in other tabs/devices without refreshing.
- **Autosave** — notes and inline edits save when you stop typing.
- **Magnetic cursor** — hovering tabs and buttons wraps them with the cursor and pulls them slightly (off on touch devices and with reduced motion).

## UI layout

**Dark-frame bento grid.** A warm black background with a mix of cream, accent, and dark cards. 12 columns on desktop, a single column below 768px.

| Area | Left | Right |
|---|---|---|
| Header | Pill tabs: YouTube · Instagram · Settings | Log out |
| Title | Workspace name (large) | |
| **Today** | Upload schedule — 7 cols · cream | Checklist — 5 cols · accent |
| | Editing progress — 12 cols · dark (Shot · Editing · In review · Uploaded) | |
| **Explore** | Today's trends — 8 cols · cream (📺 channels / 🔍 keywords) | Pinned ideas — 4 cols · dark |
| | Recent references — 6 cols · dark | Hashtag bank — 6 cols · dark |
| | Quick notes — 8 cols · cream | Performance snapshot — 4 cols · accent |
| Footer | Font credit | |

### Design tokens

| Token | Value | Use |
|---|---|---|
| `ink` | `#1C1818` | Page background, text on light cards |
| `panel` | `#262020` | Dark cards |
| `line` | `#3A3131` | Dark card borders |
| `cream` | `#F6EFEB` | Cream cards, text on dark |
| `muted` | `#A89A96` | Secondary text |
| `accent` | YouTube `#D4A5A5` · Instagram `#B5A5D4` | Accent (switches with the tab) |
| `danger` | `#E07A6F` | Delete, errors |

- Font: SejongGeulggot for both Korean and English; bold, tight headings
- Shape: 20px card radius, pill buttons/tabs/tags, 8px gaps
- Shared components: `Card` (cream · accent · dark), `Button` (primary · ink · ghost · danger), `IconButton`, `PillTabs`, `Tag`, field classes — `src/components/ui/`

## Motion & interaction

### Magnetic cursor
Rebuilt from the [Fluid Magnetic Cursor on 21st.dev](https://21st.dev/@jahed/components/magnetic-cursor) (`src/components/ui/magnetic-cursor.tsx`, gsap).

| Behavior | Description |
|---|---|
| Follow | A circle smoothly trails the mouse (lerp 0.1); the system cursor stays visible |
| Stretch | Fast movement stretches and rotates it in the direction of travel |
| Invert | `mix-blend-mode: exclusion` plus a contrast boost keeps it visible on light cards and dark backgrounds |
| Snap | Hovering a tab or button morphs the cursor into that element's shape (with padding) |
| Pull | The hovered element drifts toward the cursor (strength 0.35) and springs back elastically on leave |

- Applies to elements with `data-magnetic`: header pill tabs, `Button`, trend pin buttons, and the trends settings arrow.
- Excluded: inputs, checkboxes, small icon buttons (move/delete), disabled buttons.
- Uses event delegation, so late-rendered buttons work, and the cursor keeps moving if the hovered button disappears (after adding an item or navigating).
- Off on devices without a fine pointer (`hover: hover` and `pointer: fine`); on touchscreen laptops it turns on when you use a mouse.
- With **reduced motion** (`prefers-reduced-motion`), only a plain circle follows the pointer: no lag, stretch, pull, or morph.

### Other interactions
- **Optimistic updates:** add, edit, delete, check, and kanban moves show before the server responds; on failure only the changed fields roll back.
- **Realtime sync:** changes from other tabs and devices appear without refreshing (Supabase Realtime).
- **Autosave:** notes and inline edits save 0.8s after you stop typing, with a "Saving… / Saved" indicator.
- **Hover & focus:** buttons only transition colors (`transition-colors`, so CSS doesn't fight the cursor pull), and keyboard focus shows an outline ring.

## Tech stack

| Area | Used |
|---|---|
| Framework | Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript |
| Styling | Tailwind CSS 4 (`@theme` tokens), lucide-react, SejongGeulggot font |
| Backend | Supabase — Postgres + RLS, Auth, Realtime |
| External API | YouTube Data API v3 |
| Other | next-intl (ko/en), zod, gsap (magnetic cursor) |
| Tests | Vitest (138) |
| Hosting | Vercel |

## Getting started

### Prerequisites (all free)

| Item | Purpose |
|---|---|
| Node.js 22.12+ (24 recommended) | Dev server |
| Supabase project (free plan) | Database, auth, realtime |
| Google Cloud project | YouTube Data API key, Google sign-in |

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the migrations **once each, in order**:
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_trend_sources.sql`
   3. `supabase/migrations/0003_keyword_pool.sql`
   4. `supabase/migrations/0004_kanban_notion_links.sql`

   When updating an existing deployment, run new migrations **before** deploying the new code; otherwise realtime sync and trend fetching fail.
3. Run `supabase/tests/rls_check.sql` and confirm it returns `RLS OK`.
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (your deployed URL after deploying)
   - Redirect URLs: `http://localhost:3000/auth/callback` (add `https://<deployed URL>/auth/callback` after deploying)
5. Copy the Project URL and anon (public) key from **Project Settings → API**.

### 2. YouTube Data API key

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable "YouTube Data API v3" under **APIs & Services → Library**.
3. Create a key under **APIs & Services → Credentials → Create credentials → API key**.
4. Restrict the key to "YouTube Data API v3".

The free quota is 10,000 units per day. One trend fetch uses about 430 units (4 least-recently searched keyword groups × one 100-unit search + up to 10 benchmark channels + video details). "Fetch today's trends again" costs the same. No billing is required.

### 3. Google sign-in (optional)

1. Set up **APIs & Services → OAuth consent screen** (External; add your email as a test user).
2. **Credentials → Create credentials → OAuth client ID** → Web application
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
     (the exact URL is shown under Supabase **Authentication → Sign In / Providers → Google**)
3. Enter the Client ID and Client Secret in Supabase's Google provider and enable it.

### 4. Run locally

```bash
cp .env.example .env.local   # fill in the three values
npm install
npm run dev
```

Open http://localhost:3000 → sign up → YouTube dashboard.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `YOUTUBE_API_KEY` | YouTube Data API key (server only — never publish it) |

### 5. Deploy to Vercel

1. Import this GitHub repository in Vercel (framework: Next.js).
2. Add the three **Environment Variables** (Production and Preview); mark `YOUTUBE_API_KEY` as Sensitive.
3. After deploying, add the deployed URL to Supabase's Site URL and Redirect URLs (see 1-4).
4. Every push to `main` redeploys automatically.

### Testing on a phone (local)

1. Put your PC and phone on the same Wi-Fi and run `npm run dev -- -H 0.0.0.0`.
2. Open `http://<PC LAN IP>:3000` on the phone (Windows: `ipconfig`).
3. Add `http://<PC LAN IP>:3000/auth/callback` to Supabase Redirect URLs.
4. Uncomment `allowedDevOrigins` in `next.config.ts` and set it to **your PC's LAN IP** (the Next.js 16 dev server blocks HMR from non-localhost origins; no need to commit this).
5. Confirmation emails link to the Site URL, so **sign up and confirm on the PC**, then only **log in** on the phone.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | Type check |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Project structure

```
src/
  app/                 # routes (login, /youtube, /instagram, settings, auth callback)
  components/ui/       # Card, Button, PillTabs, Tag, fields, magnetic cursor
  features/            # per-widget UI + data (schedule, checklist, kanban, trends …)
  lib/
    realtime/          # optimistic updates, Realtime subscriptions, autosave
    trends/            # rotation, OR queries, relevance scoring, 4+4 merge
    youtube/           # YouTube API calls (tested with a fake fetch)
  i18n/                # next-intl setup, locale persistence
messages/              # ko.json / en.json
supabase/              # migrations, RLS check script
docs/superpowers/      # design specs and implementation plans
```

Design specs live in [`docs/superpowers/specs`](docs/superpowers/specs) and implementation plans in [`docs/superpowers/plans`](docs/superpowers/plans) (written in Korean).

## Font license

Both Korean and English text use **SejongGeulggot** (`src/app/fonts/SejongGeulggot.ttf`).

- Copyright: Sejong Special Self-Governing City (public work, free to use under the Ministry of Culture, Sports and Tourism public-work guidelines)
- Terms: no paid transfer or sale, no redistribution of modified versions → this repository includes the **original TTF, unmodified** (no format conversion or subsetting).
- Credit: web use requires naming the copyright holder, so every page shows "This site uses the SejongGeulggot font by Sejong Special Self-Governing City." at the bottom.
- Source: https://noonnu.cc/font_page/1523
