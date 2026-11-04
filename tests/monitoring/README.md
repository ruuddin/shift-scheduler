# Nightly-test metric monitoring

Two-stage pipeline that watches the nightly suite's key metrics and raises
an alert when the latest run looks anomalous compared to recent history.
Plain Node, no dependencies — same style as the other suites under `tests/`.

## Pipeline

```
nightly job saves its output  →  collect.js  →  history.jsonl  →  detect.js  →  ALERT lines
      (last-run.log)              (parse+append)   (one JSON/run)    (baseline compare)
```

1. **Collect** (`node tests/monitoring/collect.js`): parses the saved nightly
   run log (`NIGHTLY_LOG`, default `tests/monitoring/last-run.log`) and
   appends one JSON record per run to `tests/monitoring/history.jsonl`:
   `{ts, requests, errors, non2xx, p50, p99, pass, fail}`. The load suite's
   `requests=N errors=N non2xx=N p50=Nms p99=Nms` line supplies the latency
   numbers; lines starting with `PASS:`/`FAIL:` supply the totals. Exits 1 if
   the log is missing — it never fabricates data.
2. **Detect** (`node tests/monitoring/detect.js`): compares the latest record
   against a rolling baseline of up to 14 prior runs and alerts when:
   - p99 exceeds baseline mean + 3 standard deviations **and** is more than
     25% above the mean (guards against flagging noise when the baseline is
     very tight);
   - any request errors appear while the baseline had zero;
   - any suite FAIL lines appear while the baseline had zero.

   Prints `ALERT: ...` lines and exits 1 on anomaly, `OK: ...` and exits 0
   when clean.

Run both with:

```sh
npm run test:nightly:monitor
```

## Cold start

`history.jsonl` and `last-run.log` are gitignored — a fresh clone has no
history. Until 5 prior runs exist, `detect.js` prints a `BASELINE: collecting
history (n/5 runs)` notice and exits 0 instead of judging. After about a week
of nightly runs the baseline is live.

## Wiring into the nightly job (proposed, not yet applied)

Add one step to the nightly cron spec after the suite run, so ALERT lines land
in the chat report:

```md
4. Save the full output of step 2 to `tests/monitoring/last-run.log`, then run
   `npm run test:nightly:monitor` and include any `ALERT:` lines verbatim in
   the chat report.
```

Enabling this in the scheduled job is a follow-up decision — the scripts,
wiring docs, and npm script are ready now.
