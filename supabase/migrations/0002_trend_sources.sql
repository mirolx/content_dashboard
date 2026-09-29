-- 트렌드 추천 개선: 벤치마킹 채널 + 트렌드 출처
-- Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 실행한다. (0001 다음에 한 번)

create table public.benchmark_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  channel_id text not null,
  handle text,
  title text not null,
  thumbnail_url text not null default '',
  uploads_playlist_id text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, channel_id)
);

alter table public.benchmark_channels enable row level security;

create policy "benchmark_channels: select own" on public.benchmark_channels
  for select to authenticated using (user_id = (select auth.uid()));
create policy "benchmark_channels: insert own" on public.benchmark_channels
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_workspace(workspace_id));
create policy "benchmark_channels: delete own" on public.benchmark_channels
  for delete to authenticated using (user_id = (select auth.uid()));

-- 기본 권한을 걷어내고 필요한 것만 부여한다 (채널 정보는 수정하지 않는다).
revoke all on public.benchmark_channels from anon, authenticated;
grant select, insert, delete on public.benchmark_channels to authenticated;

alter publication supabase_realtime add table public.benchmark_channels;

-- 트렌드가 어느 소스에서 왔는지. 기존 행은 키워드 검색 결과다.
alter table public.trend_topics
  add column source text not null default 'keyword'
  check (source in ('channel', 'keyword'));
