# Log Drain — Setup

Vercel's dashboard only keeps function logs for a short retention window,
which makes after-the-fact p99 investigations (see
`docs/P99-DEBUG-RUNBOOK.md`, step 2) depend on catching the problem live.
This drain stores the logs in our own Supabase project instead:
Vercel POSTs log batches to `/api/log-drain`, the endpoint stores them in
the `app_logs` table.

The endpoint ships **fail-closed**: until `LOG_DRAIN_SECRET` is set it
returns 404, and afterwards it only accepts requests carrying that secret
in the `x-log-drain-secret` header.

## One-time setup (owner)

1. **Create the table.** In the Supabase dashboard → SQL Editor, run
   `supabase/log-drain.sql`. (RLS is on with no policies — only the
   service-role writer can insert; reads are dashboard/SQL only.)

2. **Set the secret.** In Vercel → shift-scheduler → Settings →
   Environment Variables (Production), add:
   - `LOG_DRAIN_SECRET` — a long random value you generate and keep.
     Then redeploy (or wait for the next deploy) so functions pick it up.

3. **Create the drain.** In Vercel → shift-scheduler → Settings →
   Log Drains → Create:
   - **Sources:** Lambda (function) logs (add Edge/Static later if wanted)
   - **Endpoint:** `https://shift-scheduler-blond-two.vercel.app/api/log-drain`
   - **Format:** NDJSON (the endpoint also accepts the JSON-array format)
   - **Custom header:** name `x-log-drain-secret`, value = the same
     `LOG_DRAIN_SECRET` from step 2.

4. **Verify.** Generate a function log (open the app, hit a page or two),
   wait a minute, then in the Supabase SQL Editor:
   ```sql
   select received_at, ts, source, path, status_code
   from app_logs order by received_at desc limit 10;
   ```
   Rows appearing = the drain is live.

## Querying during an incident

- Slowest paths in a window: group `app_logs` by `path` over the window in
  question (the `raw` jsonb holds the full Vercel record, including
  duration fields, for anything the columns don't cover).
- Errors only: `where status_code >= 500`.

## Housekeeping

- `app_logs` grows with traffic. If it ever gets large, prune with
  `delete from app_logs where received_at < now() - interval '30 days';`
  (no automatic retention job yet — noted as a follow-up).
- Rotating the secret = change the Vercel env var + the drain's custom
  header; no code change.
