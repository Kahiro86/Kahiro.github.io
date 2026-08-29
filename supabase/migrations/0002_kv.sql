-- The kv table — the store every `architect:` record syncs into.
--
-- This DDL existed only in the live project until now. src/shared/sync.js
-- writes to this table on every change, and ARCHITECTURE.md asserted "RLS,
-- own rows only" with nothing in the repo to back the claim. An unversioned
-- schema is one nobody can review, restore, or stand up a second time.
--
-- Safe to run against a project that already has the table: every statement
-- is idempotent, and the policy is dropped and recreated rather than assumed.
-- Run it once in the SQL editor. See docs/PUSH.md for the push tables.

create table if not exists kv (
  user_id    uuid        not null default auth.uid(),
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  -- One row per (user, key). This is not decoration: sync.js:118 upserts with
  -- onConflict "user_id,key", and without this constraint every write inserts
  -- a duplicate instead of replacing — silently, and only on the server.
  primary key (user_id, key)
);

alter table kv enable row level security;

-- The anon key is public by design (it ships in the page source), so this
-- policy is the only thing standing between one user's rows and another's.
drop policy if exists "own rows" on kv;
create policy "own rows" on kv
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime: sync.js subscribes to postgres_changes on public.kv, filtered to
-- the signed-in user. Without the table in this publication the socket
-- connects and never delivers, and the app falls back to 60-second polling —
-- which works, so the omission is invisible except as staleness.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kv'
  ) then
    alter publication supabase_realtime add table kv;
  end if;
end $$;

-- ── Verifying an existing project ────────────────────────────────────
-- Run these three and check the answers before trusting the table:
--
--   select relrowsecurity from pg_class where relname = 'kv';
--     -- must be true; false means every row is readable with the anon key
--
--   select policyname, cmd, qual from pg_policies where tablename = 'kv';
--     -- must show a policy whose qual references auth.uid()
--
--   select conname, contype from pg_constraint
--    where conrelid = 'kv'::regclass and contype in ('p','u');
--     -- must show a primary key or unique constraint over (user_id, key)
