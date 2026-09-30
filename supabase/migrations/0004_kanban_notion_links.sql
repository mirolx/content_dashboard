-- 칸반 카드 ↔ Notion 페이지 연결
-- Supabase 대시보드 → SQL Editor에서 0003 다음에 한 번 실행한다. (새 코드를 배포하기 전에)

alter table public.kanban_cards
  add column notion_url text
  check (notion_url is null or notion_url ~* '^https://([a-z0-9-]+\.)*notion\.(so|site)(/|$)');
