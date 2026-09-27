-- RLS 검증: SQL Editor에서 전체 실행. 마지막에 'RLS OK'가 나오면 통과.
-- 트랜잭션을 rollback하므로 데이터가 남지 않는다.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rls-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-b@test.local');

-- 트리거가 사용자마다 워크스페이스 2개 + 키워드 3개를 만들었는지
do $$
begin
  if (select count(*) from public.workspaces
      where user_id = '00000000-0000-0000-0000-00000000000a') <> 2 then
    raise exception 'FAIL: signup trigger did not create 2 workspaces';
  end if;
  if (select count(*) from public.trend_keywords
      where user_id = '00000000-0000-0000-0000-00000000000a') <> 3 then
    raise exception 'FAIL: signup trigger did not create 3 keywords';
  end if;
end $$;

select set_config('test.a_ws',
  (select id::text from public.workspaces
   where user_id = '00000000-0000-0000-0000-00000000000a' and platform = 'youtube'),
  true);

-- 사용자 A로 행 하나 생성
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.checklist_items (workspace_id, content, position)
  values (current_setting('test.a_ws')::uuid, 'A secret', 1);

-- 사용자 B로 전환
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare
  n int;
begin
  if exists (select 1 from public.checklist_items) then
    raise exception 'FAIL: B can read A checklist';
  end if;
  if (select count(*) from public.workspaces) <> 2 then
    raise exception 'FAIL: B should see exactly its own 2 workspaces';
  end if;

  update public.checklist_items set content = 'hacked';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B updated A rows'; end if;

  delete from public.checklist_items;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A rows'; end if;

  begin
    insert into public.checklist_items (workspace_id, content, position)
      values (current_setting('test.a_ws')::uuid, 'intrusion', 1);
    raise exception 'FAIL: B inserted into A workspace';
  exception when insufficient_privilege then
    null; -- 기대한 RLS 거부
  end;
end $$;

select 'RLS OK' as result;
rollback;
