-- 키워드 풀: 그룹·로테이션, 트렌드 관련도 점수
-- Supabase 대시보드 → SQL Editor에서 0002 다음에 한 번 실행한다.

alter table public.trend_keywords
  add column group_name text check (group_name is null or char_length(group_name) between 1 and 30),
  add column last_searched_on date;

alter table public.trend_topics
  add column relevance integer not null default 0,
  add column matched_keywords text[] not null default '{}';
