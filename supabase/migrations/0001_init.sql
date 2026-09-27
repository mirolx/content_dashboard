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
