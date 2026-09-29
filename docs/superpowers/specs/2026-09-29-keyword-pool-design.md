# 키워드 풀 · 로테이션 · 관련도 순위 설계

- 작성일: 2026-09-29
- 선행 작업: `2026-09-29-trend-sources-design.md` (브랜치 `feat/trend-sources`)
- 브랜치: `feat/keyword-pool`
- 상태: 설계 승인됨

## 1. 배경과 목표

사용자는 벤치마킹 채널들에서 니치 키워드 약 60개를 모았다(자기계발, 글로우업·뷰티, 습관·루틴, 외로움·관계, 혼자 사는 삶, 절약·돈, 연도·시즌, 롱테일 how-to, 채널 고유 키워드). 현재는 키워드를 등록 순 5개만 검색하고 조회수로만 정렬한다.

목표: 키워드를 많이 등록해도 할당량을 늘리지 않고 전부 활용하며, 니치에 더 맞는 영상을 먼저 보여준다.

1. **키워드 풀 + 그룹**, 목록 한꺼번에 붙여넣기
2. **매일 로테이션**: 하루 10개, 그룹마다 오래 안 쓴 것부터
3. **OR 묶음 검색**: 같은 그룹 키워드를 `a|b|c`로 묶어 호출 수 절감
4. **관련도 점수**: 풀 전체 키워드 매칭 수로 순위 (관련도 우선, 같은 점수는 조회수 순)

### 범위 밖
- 그룹 이름 변경·병합 UI, 키워드별 가중치, 제외 키워드
- 채널 설명 등 외부 텍스트에서 키워드 자동 추출

## 2. 키워드 풀

- `trend_keywords`에 `group_name text null`(없으면 "기타"로 표시)과 `last_searched_on date null` 추가.
- 워크스페이스당 키워드 **최대 100개**.
- 키워드 규칙(기존과 동일): 앞뒤 공백 제거, 연속 공백 하나로, 1~60자, 대소문자만 다른 중복 금지.
- **일괄 추가 (Server Action `addKeywords(workspaceId, groupName, text)`)**
  1. `requireUser()`, uuid 검증.
  2. `parseKeywordList(text)`: 쉼표·줄바꿈으로 나누고 정리, 빈 값·60자 초과 제거, 입력 안의 대소문자 중복 제거(첫 등장 유지).
  3. 기존 키워드와 대소문자 무시 비교로 중복 제거.
  4. 100개 한도를 넘는 부분은 잘라낸다.
  5. 한 번의 insert로 저장, 저장된 행을 돌려준다.
  6. 결과: `{ ok: true; rows; added; skipped; truncated }` 또는 `{ error: 'invalid' | 'limit' | 'failed' }` (`limit`: 이미 100개라 하나도 못 넣음).
- 그룹 이름: 앞뒤 공백 제거, 최대 30자, 비어 있으면 null.

## 3. 로테이션 (`pickRotation`)

- 입력: 키워드 목록(`keyword`, `group_name`, `last_searched_on`), 개수 `n = 10`.
- 그룹별로 `last_searched_on` 오름차순(null이 가장 먼저), 같으면 등록 순.
- 라운드 로빈: 그룹 순서(그룹 이름 가나다순, null 그룹은 마지막)대로 각 그룹에서 하나씩 뽑는 것을 반복해 `n`개를 채운다.
- 트렌드 저장이 **성공한 뒤에만** 뽑힌 키워드의 `last_searched_on`을 오늘(서울 날짜)로 갱신한다. 갱신 실패는 로그만 남기고 결과에는 영향 없음.

## 4. OR 묶음 검색 (`buildOrQueries`)

- 뽑힌 키워드를 그룹별로 모아 최대 **4개**씩 `|`로 이어 붙인 검색어를 만든다 (`glow up|skincare routine|that girl`).
- 그룹 안에서 4개를 넘으면 여러 묶음이 된다.
- 묶음마다 `search.list` 1회: 기존 파라미터(`type=video`, `order=relevance`, `relevanceLanguage=en`, `regionCode=US`, 최근 7일) + **`maxResults=50`**.
- 하루 할당량: 묶음 수(보통 3~5) × 100 + 채널 + 영상 상세 ≈ 300~500 units.

## 5. 관련도 점수 (`scoreVideo`)

- 기준 키워드: **풀 전체** (오늘 검색에 쓴 10개만이 아님).
- 대상 텍스트: 제목, 태그(`snippet.tags`), 설명 앞 500자. 모두 소문자로 비교.
- 매칭은 구문 단위: 키워드 앞뒤가 글자·숫자가 아니어야 한다 (`glow up`은 "glowing up"에 맞지 않음, "Glow Up Tips"에는 맞음).
- 점수: 제목에서 맞으면 키워드당 **2점**, 제목에는 없고 태그·설명에서 맞으면 **1점**.
- 결과: `{ relevance: number; matched: string[] }` (matched는 점수 높은 순, 원래 표기).

### 적용
- **키워드 추천**: 3분 이하·카테고리 필터 후, **relevance 0은 제외**, 정렬은 relevance 내림차순 → 조회수 내림차순.
- **벤치마킹 채널**: 기존 필터(30일, 3분) 후 relevance 0도 유지, 정렬은 relevance 내림차순 → 조회수 내림차순, 그 뒤 채널당 2개 제한.
- `pickTrends`는 입력 순서를 그대로 쓰므로 변경 없음.

## 6. 데이터 모델 (`supabase/migrations/0003_keyword_pool.sql`)

- `trend_keywords`: `group_name text` (check: null 또는 1~30자), `last_searched_on date`.
- `trend_topics`: `relevance integer not null default 0`, `matched_keywords text[] not null default '{}'`.
- 오늘 트렌드 재조회와 폴백 정렬: `relevance desc, view_count desc`.
- 기존 권한(0001의 trend_keywords/trend_topics select/insert/update/delete)으로 충분하다.

## 7. 화면

### 설정 — 트렌드 검색 키워드
- 도움말: 매일 그룹마다 돌아가며 10개를 골라 검색하고, 키워드가 많이 겹치는 영상을 먼저 보여준다는 설명, 최대 100개.
- 추가 폼: 그룹 입력(기존 그룹 `datalist` 자동완성) + 여러 줄 입력 + 추가 버튼. 결과 문구 "N개 추가했어요 (중복 M개 건너뜀)", 한도로 잘린 경우 안내.
- 목록: 그룹별 소제목(가나다순, "기타"는 마지막) 아래 칩, × 삭제(기존 `useLiveList` 패턴).

### 대시보드 트렌드 위젯
- 카드마다 `matched_keywords` 앞 3개를 작은 태그로 표시. 없으면 표시하지 않음.

모든 문구는 `messages/{ko,en}.json`.

## 8. 코드 구조

| 파일 | 책임 |
|---|---|
| `src/lib/trends/parseKeywordList.ts` | 붙여넣기 텍스트 → 키워드 목록 |
| `src/lib/trends/pickRotation.ts` | 오늘 쓸 키워드 10개 |
| `src/lib/trends/buildOrQueries.ts` | 그룹별 OR 검색어 |
| `src/lib/trends/scoreVideo.ts` | 관련도 점수·매칭 키워드, 정렬 비교 함수 |
| `src/lib/youtube/api.ts` | `VideoDetail`에 `tags`, `description` 추가 |
| `src/lib/youtube/fetchKeywordVideos.ts` | 입력을 검색어 목록으로, `maxResults=50`, 점수 필터·정렬 |
| `src/lib/youtube/fetchChannelVideos.ts` | 점수 정렬 적용 |
| `src/lib/trends/getTodayTrends.ts` | 로테이션·OR 검색·점수 저장·`last_searched_on` 갱신 |
| `src/features/trends/keywordActions.ts` | `addKeywords` Server Action |
| `src/features/trends/KeywordSettings.tsx` | 그룹 폼·그룹별 목록 |
| `src/features/trends/TrendsWidget.tsx` | 매칭 키워드 태그 |

## 9. 에러 처리

- 검색·저장 실패: 기존과 같이 전체 실패 → 저장 안 함 → 최근 저장분 폴백.
- `last_searched_on` 갱신 실패: 로그만, 결과 정상 반환.
- 일괄 추가: 파싱 결과가 비면 `invalid`, 한도로 하나도 못 넣으면 `limit`, DB 오류는 `failed`.

## 10. 테스트와 검증

- **Vitest (먼저 작성)**: `parseKeywordList`, `pickRotation`, `buildOrQueries`, `scoreVideo`(구문 경계, 제목 2점/태그·설명 1점, 대소문자), `fetchVideoDetails`의 tags/description 매핑, `fetchKeywordVideos`(검색어·`maxResults=50`, 점수 0 제외, 정렬), `fetchChannelVideos`(점수 정렬 후 채널당 2개).
- **브라우저**: 목록 붙여넣기 → 그룹별 표시 → 다시 가져오기 → 매칭 태그 표시 → 순위가 관련도 우선인지 확인 → `last_searched_on`이 오늘로 바뀌고 다음 조회에서 다른 키워드가 뽑히는지(SQL로 날짜를 과거로 돌려 확인).
- **사용자 작업**: `0003_keyword_pool.sql` 실행.
