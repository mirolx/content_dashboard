# 트렌드 추천 다양성 개선 설계

- 작성일: 2026-10-01
- 선행: 트렌드 소스, 키워드 풀 (모두 `main`에 병합)
- 브랜치: `feat/trend-diversity`
- 상태: 설계 승인됨

## 1. 문제

관련도 점수는 잘 맞지만 같은 영상·같은 주제(living alone)가 계속 추천된다. 원인:

1. **벤치마킹 섹션은 입력이 매일 같다.** 등록 채널의 최근 30일 영상을 풀 전체와 비교해 정렬하므로, 새 업로드가 없으면 "다시 가져오기"를 눌러도 결과가 같다. 키워드 로테이션과 무관하다.
2. **포함 관계 키워드가 점수를 중복으로 받는다.** 풀에 `alone`·`living alone`·`living alone diaries`가 함께 있어 "Living Alone Diaries" 제목은 6점, `storytelling` 하나만 맞는 영상은 2점이다.
3. **이전 추천을 기억하지 않는다.** 어제 추천한 영상이 오늘 다시 나와도 거르지 않는다.

## 2. 범위

포함: 점수 계산(①), 다양성 선택(②), 최근 추천 제외(③), 벤치마킹 섹션의 오늘 키워드 가산점(④).

제외: YouTube API 호출 추가(할당량 1회 ≈ 430 units 유지), DB 마이그레이션, 화면 UI 변경.

## 3. 설계

### ① 포함 관계 키워드는 가장 긴 것만 센다 — `src/lib/trends/scoreVideo.ts`

- 매칭된 키워드 k가 다른 매칭 키워드 m 안에 구문으로 들어 있으면(`containsPhrase(m, k)`, 대소문자 무시) k를 뺀다.
  - 단, m이 태그·설명에서만 맞고 k가 제목에서 맞았다면 k를 빼지 않는다(제목 매칭을 설명 매칭으로 지우지 않음).
- 대소문자만 다른 같은 키워드가 풀에 두 번 있으면 처음 것만 센다.
- 점수와 `matched`(카드의 키워드 태그)는 남은 키워드 기준이다. 제목 2점·태그/설명 1점, 제목 매칭이 먼저인 규칙은 그대로.
- 예: 제목 "Living Alone Diaries", 풀 `alone`·`living alone`·`living alone diaries` → 2점, `matched = ['living alone diaries']`.
- 포함 관계가 아닌 키워드(`lonely`와 `living alone`)는 각각 센다.

### ④ 벤치마킹 섹션 정렬에 오늘 키워드 가산점 — `src/lib/youtube/fetchChannelVideos.ts`

- 새 인자 `boost: string[]`(오늘 로테이션 키워드, 기본 `[]`).
- 정렬 키 = `relevance + 2 × (matched 중 boost에 든 키워드 수)`, 같으면 조회수. 채널당 2개 제한은 이 정렬 뒤에 적용.
- 저장·표시되는 `relevance`는 원래 점수 그대로(가산점은 정렬에만).
- `getTodayTrends`가 `rotation`의 키워드를 `boost`로 넘긴다.

### ② 주제 다양성 — `src/lib/trends/pickTrends.ts`

- 새 옵션 `groupOf: (keyword: string) => string`. 영상의 대표 그룹 = `matched[0]`(제목 매칭 우선)의 그룹. `matched`가 비면(관련도 0) 대표 그룹이 없다.
- 각 소스 목록을 먼저 다양성 순서로 재배열한다: 앞에서부터 아직 나오지 않은 그룹의 영상을 순서대로 뽑고, 그 뒤에 미뤄 둔 영상(이미 나온 그룹 + 대표 그룹 없는 영상)을 원래 순서로 붙인다. 관련도 0 영상이 관련 있는 영상을 앞지르지 않게 하기 위해서다.
- 재배열 뒤의 선택 로직(소스별 4개, 모자라면 다른 소스로 채움, 채널에서 뽑힌 영상은 키워드에서 제외)은 기존과 같다. 채널당 2개 제한은 `fetchChannelVideos`에서 이미 적용됨.
- `getTodayTrends`는 풀에서 `keyword(소문자) → group_name ?? keyword` 맵을 만들어 `groupOf`로 넘긴다. 맵에 없는 키워드는 키워드 자체를 그룹으로 본다.

### ③ 최근 추천 제외 — `src/lib/trends/getTodayTrends.ts`, `src/features/trends/actions.ts`

- `getTodayTrends(workspaceId, { exclude?: string[] })`.
- YouTube 조회 전에 `trend_topics`에서 `fetched_on`이 (오늘 − 7일) 이상, 오늘 미만인 `video_id`를 읽어 `exclude`와 합친다. 이 조회가 실패하면 제외 없이 진행한다(추천 자체는 막지 않음).
- 두 후보 목록에서 제외 집합의 영상을 뺀 뒤 `pickTrends`. 벤치마킹 후보가 비면 기존 로직대로 키워드 쪽이 채운다.
- 걸러낸 두 목록이 **모두** 비면 제외하지 않은 목록으로 다시 고른다(빈 화면 방지).
- `refetchTodayTrends`는 오늘 행을 지우기 전에 오늘의 `video_id`를 읽어 `exclude`로 넘긴다. 읽기 실패 시 빈 목록으로 진행.
- 날짜 계산: `seoulDateString(new Date(now − 7일))`.

## 4. 오류 처리

- 최근 기록·오늘 기록 조회 실패는 제외 목록을 비운 채 진행한다.
- 기존의 실패 폴백(가장 최근 날짜 트렌드 반환)과 로테이션 기록 방식은 바꾸지 않는다.

## 5. 테스트 (Vitest, 가짜 데이터)

- `scoreVideo`: 포함 관계는 가장 긴 것만, 제목 매칭은 설명 전용 상위 키워드에 지워지지 않음, 대소문자 중복 키워드 1회, 포함 관계 아닌 키워드는 각각.
- `fetchChannelVideos`: `boost` 키워드가 맞는 영상이 앞으로 오고 `relevance` 값은 그대로.
- `pickTrends`: 같은 그룹 영상은 뒤로 밀림, 다양한 그룹이 모자라면 미뤄 둔 영상으로 채움, `groupOf` 없으면 기존 동작.
- 제외 로직은 순수 함수 `excludeVideos(channel, keyword, exclude)`(`src/lib/trends/excludeVideos.ts`)로 분리해 테스트: 제외 적용, 모두 비면 원래 목록 반환.
- 기존 테스트, typecheck, lint, build 통과.
