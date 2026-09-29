# 트렌드 추천 개선 — 벤치마킹 채널 + 니치 필터 설계

- 작성일: 2026-09-29
- 선행 작업: `2026-09-28-creator-dashboard-foundation-design.md` (브랜치 `feat/foundation`)
- 브랜치: `feat/trend-sources` (`feat/foundation`에서 분기)
- 상태: 설계 승인됨

## 1. 배경과 목표

현재 "오늘의 트렌드 추천"은 키워드마다 영어권 최근 7일 영상을 **조회수 순**으로 검색해 상위 8개를 보여준다. 넓은 키워드(`authentic`, `raw story`)와 조회수 정렬 탓에 니치와 무관한 영상(음식·다큐)과 숏츠가 상위를 차지한다.

목표: 크리에이터의 yapping/스토리텔링 니치에 맞는 영상을 추천한다.

- **(A) 니치 필터**: 숏츠 제외, 카테고리 제한, 관련도 우선 검색
- **(C) 벤치마킹 채널**: 사용자가 등록한 채널들의 최근 인기 영상

### 범위 밖
- 인스타그램 트렌드 (여전히 없음)
- 제외 키워드(B안), Claude 요약
- 한쪽 소스만 실패했을 때의 부분 성공 처리

## 2. 위젯 표시

- 트렌드 위젯을 두 묶음으로 나눈다: **"📺 벤치마킹 채널"** 최대 4개, **"🔍 키워드 추천"** 최대 4개. 카드 모양·pin 동작은 기존과 같다.
- 한 묶음의 결과가 4개보다 적으면 모자란 만큼 다른 묶음 결과로 채운다(총 최대 8개). 채운 영상은 원래 출처 묶음에 표시한다.
- 결과가 0개인 묶음은 제목째 숨긴다.
- 채널과 키워드가 둘 다 없으면 "설정에서 채널이나 키워드를 추가하세요" + 설정 링크.

## 3. 영상 선정 규칙

### 공통
- **숏츠 제외**: `contentDetails.duration`이 **180초 이하**인 영상은 버린다 (YouTube API에 숏츠 여부 필드가 없으므로 길이로 판단).
- 조회수 = `statistics.viewCount`.

### 벤치마킹 채널
1. 채널별로 업로드 재생목록(`contentDetails.relatedPlaylists.uploads`, 등록 시 저장)을 `playlistItems.list`(`maxResults=20`)로 읽는다 — 채널당 1 unit.
2. 모든 채널의 영상 ID를 모아 `videos.list`(`part=snippet,statistics,contentDetails`, 50개씩)로 상세를 가져온다.
3. **최근 30일** 안에 게시된 영상만 남긴다 (`snippet.publishedAt`).
4. 180초 이하 제외.
5. 조회수 내림차순으로 정렬하되 **채널당 최대 2개**까지만 고른다. 카테고리 필터는 적용하지 않는다(사용자가 직접 고른 채널이므로).

### 키워드 추천
1. 키워드마다 `search.list`: `type=video`, `q=<keyword>`, `relevanceLanguage=en`, `regionCode=US`, **`order=relevance`**, `publishedAfter=<now-7일>`, **`maxResults=25`** — 키워드당 100 units(기존과 동일). 키워드는 등록 순으로 최대 5개.
2. 영상 ID 중복 제거 후 `videos.list`(`part=snippet,statistics,contentDetails`)로 상세 조회.
3. 180초 이하 제외.
4. `snippet.categoryId`가 **22(People & Blogs), 23(Comedy), 24(Entertainment), 26(Howto & Style)** 인 영상만 남긴다.
5. 조회수 내림차순.

### 합치기 (`pickTrends`)
- 채널 후보(정렬·채널당 2개 제한 적용 후)와 키워드 후보(정렬 후)에서 각각 최대 4개를 고른다.
- 한쪽이 4개 미만이면 남은 자리를 다른 쪽의 다음 순위 후보로 채운다.
- 같은 영상이 양쪽에 있으면 채널 쪽에만 둔다.
- 결과: `{ videoId, …, source: 'channel' | 'keyword' }[]`, 최대 8개.

### 할당량
키워드 최대 5개 × 100 + 채널 최대 10개 × 1 + `videos.list` 몇 회 ≈ 하루 520 units (무료 한도 10,000).

## 4. 데이터 모델 (`supabase/migrations/0002_trend_sources.sql`)

### 새 테이블 `benchmark_channels`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| 공통 | `id`, `user_id`, `workspace_id`, `created_at` | 기존 규칙과 동일 |
| `channel_id` | text | `UC…` |
| `handle` | text null | `@` 없이 저장 |
| `title` | text | |
| `thumbnail_url` | text | |
| `uploads_playlist_id` | text | `UU…` |

- `unique(workspace_id, channel_id)`
- RLS: 기존 워크스페이스 테이블과 같은 select/insert/update/delete 정책, `authenticated`에 select/insert/delete grant.
- `supabase_realtime` publication에 추가.
- 워크스페이스당 최대 10개는 서버 액션에서 검사한다.

### `trend_topics` 변경
- `source text not null default 'keyword' check (source in ('channel', 'keyword'))` 추가. 기존 행은 기본값으로 `keyword`.

## 5. 설정 화면 (`/youtube/settings`)

- 키워드 섹션 **위**에 "벤치마킹 채널" 섹션을 추가한다.
  - 입력: `@handle`, `youtube.com/@handle`, `https://www.youtube.com/channel/UC…`, `UC…` 중 아무 형식.
  - 추가 → Server Action `addBenchmarkChannel(workspaceId, input)`:
    1. `requireUser()`, 입력 파싱(`parseChannelInput`), 실패 시 `invalid`.
    2. 등록 수가 10개 이상이면 `limit`.
    3. `channels.list`(`part=snippet,contentDetails`, `forHandle=` 또는 `id=`)로 조회 — 1 unit. 없으면 `not-found`.
    4. insert. 유니크 위반이면 `duplicate`.
  - 목록: 썸네일 + 채널명, × 삭제(브라우저 직접 삭제 + 낙관적 업데이트, 기존 `useLiveList` 패턴). Realtime 반영.
  - 에러 문구: 채널을 찾지 못했어요 / 이미 등록된 채널이에요 / 최대 10개까지 등록할 수 있어요 / 입력 형식을 확인해 주세요.
- "오늘 트렌드 다시 가져오기" 버튼은 두 섹션 아래의 독립 영역으로 옮긴다.
- 키워드 도움말 문구를 "관련도 순으로 찾고, 3분 이하 영상과 니치 밖 카테고리는 제외해요" 취지로 갱신한다.
- 모든 문구는 `messages/{ko,en}.json`.

## 6. 코드 구조

| 파일 | 책임 |
|---|---|
| `src/lib/youtube/parseDuration.ts` | ISO 8601 길이(`PT1H2M3S`) → 초 |
| `src/lib/youtube/parseChannelInput.ts` | 입력 → `{ handle } \| { channelId } \| null` |
| `src/lib/youtube/api.ts` | 공용 `getJson`, `YouTubeApiError`, `fetchVideoDetails(ids)` (50개씩 나눠 호출) |
| `src/lib/youtube/fetchKeywordVideos.ts` | 키워드 검색 + 필터 → 후보 목록 (기존 `fetchTrends.ts` 대체) |
| `src/lib/youtube/fetchChannelVideos.ts` | 업로드 목록 + 필터 + 채널당 2개 → 후보 목록 |
| `src/lib/youtube/lookupChannel.ts` | `channels.list` 조회 → 채널 정보 |
| `src/lib/trends/pickTrends.ts` | 4+4 합치기와 채우기 (순수 함수) |
| `src/lib/trends/getTodayTrends.ts` | 두 소스 조회 → `pickTrends` → 저장 (결과 타입에 `source` 포함) |
| `src/features/trends/ChannelSettings.tsx`, `channelActions.ts`, `channelData.ts` | 설정의 채널 섹션 |
| `src/features/trends/TrendsWidget.tsx` | 두 묶음 렌더링 |

기존 `fetchTrends.ts`와 그 테스트는 `fetchKeywordVideos`로 바뀌며 삭제한다.

## 7. 에러 처리

- 두 소스 중 하나라도 실패(네트워크, 할당량, 키 없음)하면 전체를 실패로 보고 저장하지 않으며, 기존처럼 가장 최근 날짜의 저장분을 "불러오지 못했어요"와 함께 보여준다.
- 채널 등록 실패는 설정 섹션 안에 문구로 표시한다.
- 등록된 채널이 YouTube에서 삭제·비공개된 경우 해당 채널의 `playlistItems` 404는 그 채널만 건너뛴다(다른 오류는 실패 처리).

## 8. 테스트와 검증

- **Vitest (먼저 작성)**: `parseDuration`, `parseChannelInput`, `fetchKeywordVideos`(order/maxResults 파라미터, 180초·카테고리 필터, 정렬), `fetchChannelVideos`(30일 필터, 180초 필터, 채널당 2개, 삭제된 채널 404 건너뛰기), `lookupChannel`(handle/id 분기, 없음), `pickTrends`(4+4, 채우기, 중복 제거, 8개 상한), 메시지 키 일치.
- **브라우저 확인**: 채널 등록(각 입력 형식) → 중복·한도 에러 → 다시 가져오기 → 위젯 두 묶음 표시 → 숏츠 없음 → pin → 채널 삭제 실시간 반영 → 언어 전환.
- **사용자 작업**: `0002_trend_sources.sql`을 Supabase SQL Editor에서 실행.
