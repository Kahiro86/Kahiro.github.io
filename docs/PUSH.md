# Closed-app notifications (Web Push) — setup

Kahiro can send reminders even when the app is fully closed. Because Kahiro
is a static site, the actual "send" has to come from a tiny server — a
**Supabase Edge Function** running on a schedule in **your own** Supabase
project (the same one you already use for cloud sync). This is a one-time
setup of about 10 minutes.

Nothing here is secret to Kahiro — you generate your own keys and they stay
in your Supabase project.

## What you need first

- Cloud sync already working (Settings → Account & Cloud Sync), signed in.
- The [Supabase CLI](https://supabase.com/docs/guides/cli) installed, and
  Node.js (for one command).

## 1. Generate your VAPID keys

VAPID keys are the credential the push services use to trust your sender.

```bash
npx web-push generate-vapid-keys
```

Copy the **Public Key** and **Private Key** it prints.

## 2. Create the database tables + schedule

In the Supabase dashboard → **SQL Editor**, paste the contents of
[`supabase/migrations/0001_push.sql`](../supabase/migrations/0001_push.sql).
Before running it, replace the two placeholders near the bottom:

- `<PROJECT_REF>` — your project ref (in your project URL:
  `https://<PROJECT_REF>.supabase.co`).
- `<SERVICE_ROLE_KEY>` — Settings → API → `service_role` key. Keep it
  secret; it only ever lives in this SQL you run, never in the app.

Then run it. It creates `push_subscriptions` and `push_sent`, locks them
down with row-level security, and schedules the sender to run every minute.

> The schedule uses the `pg_cron` and `pg_net` extensions. If the run
> errors, enable both under **Database → Extensions** and re-run the
> `cron.schedule(...)` block.

## 3. Deploy the Edge Function

From the repo root:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy push-reminders --no-verify-jwt
supabase secrets set \
  VAPID_PUBLIC="<your public key>" \
  VAPID_PRIVATE="<your private key>" \
  VAPID_SUBJECT="mailto:you@example.com"
```

`--no-verify-jwt` lets the cron job call it with the service-role bearer
token set in step 2. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are
provided to the function automatically — you don't set those.

## 4. Turn it on in the app

Open Kahiro → **Settings → Notifications**:

1. Paste your **VAPID public key** (the public one from step 1).
2. Tap **Enable notifications** and allow the browser prompt.
3. Tap **Send test** to confirm this device shows notifications.

Now create reminders as usual (the bell in the header → New reminder). When
one comes due, the scheduled function delivers it — even if Kahiro is
closed.

### iPhone / iPad

Web push only works for an **installed** PWA on iOS 16.4+. Add Kahiro to
your Home Screen first (Share → Add to Home Screen), open it from that
icon, then do step 4 from there.

## How it works (for the curious)

- Whenever the app is open it precomputes the next 7 days of reminder
  occurrences and syncs them as a `push_queue` record (via the same cloud
  sync you already use).
- The scheduled Edge Function reads each user's `push_queue`, sends any
  occurrence that just came due through the Web Push service, and records
  it in `push_sent` so it never fires twice — across all your devices.
- Everything is scoped by row-level security to your own account.

## Turning it off

- Per device: Settings → Notifications → **Turn off on this device**.
- Everywhere: remove the schedule with
  `select cron.unschedule('kahiro-push-reminders');` in the SQL editor.
