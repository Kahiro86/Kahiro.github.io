-- Kahiro closed-app push notifications — schema, RLS, and schedule.
-- Run this once in your Supabase project's SQL editor. See docs/PUSH.md.

-- Browser push subscriptions, one row per device.
create table if not exists push_subscriptions (
  user_id uuid not null default auth.uid(),
  endpoint text not null,
  subscription jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, endpoint)
);
alter table push_subscriptions enable row level security;
create policy "own subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Delivered-occurrence ledger, so a reminder is never sent twice.
-- Written only by the Edge Function (service role); not user-facing.
create table if not exists push_sent (
  user_id uuid not null,
  occ_key text not null,
  sent_at timestamptz default now(),
  primary key (user_id, occ_key)
);
alter table push_sent enable row level security;
-- No policies → normal users cannot read/write; the service role bypasses RLS.

-- Keep the ledger small: drop rows older than 30 days on each insert-ish.
-- (Optional; run manually or via a second cron if you like.)
-- delete from push_sent where sent_at < now() - interval '30 days';

-- ── Schedule: invoke the Edge Function every minute ──────────────────
-- Requires the pg_cron and pg_net extensions (enable them under
-- Database → Extensions). Replace <PROJECT_REF> and <SERVICE_ROLE_KEY>.
-- The service-role key is required so the function can be called; keep it
-- secret — it lives only in this SQL you run, never in the client.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'kahiro-push-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To change or remove the schedule later:
--   select cron.unschedule('kahiro-push-reminders');
