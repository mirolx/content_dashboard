# 디자인 시스템 적용 설계 (서브프로젝트 2)

- 작성일: 2026-09-30
- 선행: 기능 뼈대, 트렌드 소스, 키워드 풀 (모두 `main`에 병합)
- 브랜치: `feat/design-system`
- 상태: 설계 승인됨 (시각 결정은 브라우저 목업으로 확정)

## 1. 목표와 범위

원본 스펙의 작업 순서 ②·③: 레퍼런스(벤토 그리드, Dev.Hire 스타일) 기반 디자인 시스템을 만들고 모든 화면에 적용하며, 플랫폼별 톤을 차별화한다. 사용자가 제공한 마그네틱 커서 호버 효과를 넣는다.

### 포함
- 디자인 토큰(색·글꼴·모양), 공용 UI 컴포넌트, 마그네틱 커서
- 대시보드·설정·로그인·에러 화면에 적용
- YouTube / Instagram 포인트 색 전환

### 제외
- 라이트 모드(앱은 항상 다크), shadcn/ui 도입, 기능·문구 변경, 새 위젯

## 2. 확정된 시각 결정

- **레이아웃**: 다크 프레임(레퍼런스 A안). 페이지 배경은 따뜻한 검정, 위젯은 크림·포인트·다크 카드를 섞은 벤토 리듬.
- **포인트 색**: YouTube = 더스티 로즈 `#D4A5A5`, Instagram = 더스티 라벤더 `#B5A5D4`. 탭을 바꾸면 포인트 색 전체가 바뀐다. 로그인 등 플랫폼이 없는 화면은 로즈.
- **글꼴**: 세종글꽃체(SejongGeulggot, Regular 1종)를 한글·영문 공통으로 사용. 제목은 800 굵기·자간 -0.02em(단일 굵기라 브라우저가 굵게 합성). *(2026-09-30 Pretendard에서 변경)*
- **마그네틱**: 원형 커서는 전 화면, 마그네틱은 누르는 요소(버튼·알약 탭·트렌드 고정 버튼)에만. 입력칸·체크박스·작은 아이콘 버튼은 제외. 터치 기기·동작 줄이기에서는 끔. 시스템 커서는 숨기지 않는다.

## 3. 디자인 토큰 (`src/app/globals.css`, Tailwind 4 `@theme`)

| 토큰 | 값 | 용도 |
|---|---|---|
| `ink` | #1C1818 | 페이지 배경, 밝은 카드 위 글자 |
| `panel` | #262020 | 다크 카드 |
| `line` | #3A3131 | 다크 카드 테두리·구분선 |
| `cream` | #F6EFEB | 크림 카드, 다크 위 글자 |
| `muted` | #A89A96 | 보조 글자 |
| `accent` | `var(--accent)` | 포인트 (플랫폼별) |
| `danger` | #E07A6F | 삭제·에러 |

- `--accent`: 기본 `#D4A5A5`, `[data-platform="instagram"]` 아래에서 `#B5A5D4`.
- `(app)` 레이아웃의 클라이언트 컴포넌트 `PlatformScope`가 현재 경로에서 플랫폼을 구해(`platformFromPath`) 감싸는 요소에 `data-platform`을 단다. 헤더 탭도 이 안에 있어 같은 포인트 색을 쓴다.
- 모양: 카드 반경 20px(`rounded-[20px]`), 알약 999px, 벤토 간격 8px(`gap-2`).
- 글꼴: `src/app/fonts/SejongGeulggot.ttf`(원본 그대로, 7.8MB — 라이선스가 변형 재배포를 금지하므로 형식 변환하지 않음)를 `next/font/local`로 불러와 `--font-sejong` 변수로 두고, `font-sans`를 이 변수로. 웹 사용 조건에 따라 모든 화면 하단에 출처를 표시한다.

## 4. 공용 컴포넌트 (`src/components/ui/`)

| 컴포넌트 | API | 비고 |
|---|---|---|
| `Card` | `{ title, tone?: 'cream' \| 'accent' \| 'dark', error?, action?, children }` | 기존 `WidgetCard` 대체. tone별 배경·글자·테두리. `action`은 제목 오른쪽(예: 둥근 화살표 링크) |
| `Button` | `{ variant?: 'primary' \| 'ghost' \| 'danger', size?: 'sm' \| 'md', magnetic?: boolean }` + button props | 알약형. 기본 `magnetic=true`면 `data-magnetic` 부착 |
| `IconButton` | `{ label, children }` + button props | 작은 원형 아이콘 버튼(↑↓←→×). 마그네틱 없음 |
| `PillTabs` | `{ items: { href, label, active }[] }` | 헤더·로그인 탭. 활성은 accent 채움, 나머지 테두리. 링크에 `data-magnetic` |
| `Field` 계열 | `inputClass`, `textareaClass`, `selectClass` 문자열 상수 | tone과 무관하게 `currentColor` 기반 테두리·포커스 링 |
| `Tag` | `{ children, tone?: 'outline' \| 'accent' }` | 해시태그, 매칭 키워드, 칸반 라벨 |
| `MagneticCursor` | 원본 props 유지 | 아래 5장 |

- 아이콘: `lucide-react` (ArrowUpRight, ChevronUp/Down/Left/Right, X, Plus).
- `EditableText`는 테두리를 `border-transparent hover:border-current/30 focus:border-current/60`로 바꿔 모든 카드 톤에서 보이게 한다.

## 5. 마그네틱 커서 (`src/components/ui/magnetic-cursor.tsx`)

사용자 제공 컴포넌트를 기반으로 두 가지를 바꾼다.

1. **`vecteur` 제거**: `src/lib/cursor/vec.ts`에 `{ x, y }` 객체용 `lerp`, `sub`, `length` 순수 함수를 두고 사용(테스트 포함).
2. **이벤트 위임**: 처음 마운트 때 요소를 모으는 대신 `document`의 `pointerover`/`pointerout`/`pointermove`에서 `target.closest('[data-magnetic]')`로 대상을 찾는다. 나중에 렌더링된 버튼(트렌드 카드 등)도 동작한다.

나머지 동작(속도에 따른 늘어남, 호버 시 요소 모양으로 변형, 끌림 `magneticFactor`, `mix-blend-mode: exclusion`, 대비 보정, 터치 기기·`prefers-reduced-motion`에서 끄기)은 원본과 같다. 의존성은 `gsap`만 추가한다. 루트 레이아웃에서 `<MagneticCursor magneticFactor={0.35} cursorSize={28}>`로 한 번 감싼다.

## 6. 화면 적용

### 헤더 (`(app)/layout.tsx`)
`ink` 배경, 왼쪽 `PillTabs`(YouTube · Instagram · 설정), 오른쪽 로그아웃 `Button variant="ghost"`.

### 대시보드 (배치·span은 기존 유지)
| 위젯 | tone |
|---|---|
| 업로드 일정 | cream |
| 체크리스트 | accent |
| 편집 진행 상태 | dark (열 배경 `ink`, 카드가 있는 열 제목은 accent, 열 안 카드는 cream) |
| 오늘의 트렌드 | cream (매칭 키워드 `Tag tone="accent"`, `action`=설정으로 가는 둥근 화살표) |
| 고정된 아이디어 · 레퍼런스 · 해시태그 | dark |
| 빠른 메모 | cream |
| 성과 스냅샷 | accent |

섹션 제목("오늘 할 일", "탐색 · 영감")은 작은 대문자 라벨(`text-xs tracking-widest text-muted`). 워크스페이스 이름은 큰 제목(`text-4xl font-extrabold`).

### 설정
계정 = cream, 워크스페이스·벤치마킹 채널·키워드 = dark, 오늘 트렌드 = accent.

### 로그인
`ink` 배경 가운데 cream 카드, 큰 굵은 제목, 로그인/회원가입은 `PillTabs` 모양 버튼 탭, 제출은 `Button variant="primary"`, 구글은 `ghost`.

### 에러·404
에러 경계 화면도 `ink` 배경 + cream 카드.

## 7. 테스트와 검증

- Vitest: `vec.ts`(lerp/sub/length), `platformFromPath`.
- 기존 122개 테스트, typecheck, lint, build 통과.
- 브라우저: YouTube/Instagram이 목업과 일치(포인트 색 전환), 모바일 375px 1열·가로 스크롤 없음, 버튼 호버 시 끌림·입력칸은 끌림 없음, 설정·로그인 화면, 글자 대비(크림/로즈 위 `ink`, 다크 위 `cream`).
