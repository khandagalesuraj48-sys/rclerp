-- =====================================================================
-- RCL Fleet ERP – step 1zk: the assistant's own memory and its chats (update-186)
-- Run once in Supabase → SQL Editor, in EVERY site's project (VTR NH 848, 18B KOLHAPUR, HEAD OFFICE, …). Safe to run again.
-- It only ADDS two new, empty tables of this site (so VTR's never reach 18B, nor 18B's VTR):
--   1. ai_memory – the short notes the assistant keeps for ONE person ("RL-185 is called Mota JCB", "answer in Marathi") – only
--      when he asks it to remember something or tells it a lasting fact; he sees them and takes one out; nobody else sees them;
--   2. ai_chats – his conversations with the assistant (his questions, its answers, what it looked up), to open again later –
--      only his own; nobody else sees them, the Admin neither.
-- Only the server (the secret key) can open them. No table, row or rule of the app is changed. Until it is run the assistant
-- works as before (without memory and without the chats kept) and says this file must be run first.
-- Rollback (code first: Vercel → Instant Rollback; then, only if wanted): drop table public.ai_memory; drop table public.ai_chats;
-- =====================================================================
begin;

-- 1. the assistant's notes of a person (at most 60 a person – the app keeps to that)
create table if not exists public.ai_memory (
  id bigserial primary key,
  email text not null,                 -- whose note (lower case)
  note text not null,                  -- what to remember (at most 300 characters)
  at timestamptz not null default now()
);
create index if not exists ai_memory_email on public.ai_memory (email, id);
alter table public.ai_memory enable row level security;
revoke all on public.ai_memory from public, anon, authenticated;
grant select, insert, delete on public.ai_memory to service_role;
grant usage on sequence public.ai_memory_id_seq to service_role;
revoke update, truncate on public.ai_memory from service_role;      -- a note is kept as written, or taken out by its person

-- 2. the conversations of a person (each kept as he saw it; the newest first in his list)
create table if not exists public.ai_chats (
  id text primary key,                 -- the chat's own number (made by the app)
  email text not null,                 -- whose chat (lower case)
  title text not null default '',      -- its first question
  msgs jsonb not null default '[]'::jsonb,   -- [{ r: me / bot / src, t: text }] – at most 200, about 200 KB
  n int not null default 0,            -- how many questions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_chats_email on public.ai_chats (email, updated_at desc);
alter table public.ai_chats enable row level security;
revoke all on public.ai_chats from public, anon, authenticated;
grant select, insert, update on public.ai_chats to service_role;
revoke delete, truncate on public.ai_chats from service_role;      -- a chat is never deleted by the app

commit;
notify pgrst, 'reload schema';
select 'Step 1zk done · ai_memory ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'ai_memory')
  || ' · ai_chats ' || (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'ai_chats') as done;
