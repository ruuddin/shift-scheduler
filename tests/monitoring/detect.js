// Nightly anomaly detector — stage 2 of the monitoring pipeline.
// Compares the latest record in tests/monitoring/history.jsonl against a
// rolling baseline (up to 14 prior runs). Plain Node, no dependencies.
//
// - Fewer than 5 baseline runs: prints a BASELINE notice, exits 0
//   (cold start — not enough history to judge).
// - Anomaly: prints ALERT: lines and exits 1.
// - Clean: prints an OK: summary and exits 0.

const fs = require('fs')
const path = require('path')

const HISTORY_PATH = path.join(__dirname, 'history.jsonl')
const MIN_BASELINE = 5
const BASELINE_WINDOW = 14

function mean(xs) {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

function stddev(xs) {
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length)
}

function main() {
  if (!fs.existsSync(HISTORY_PATH)) {
    console.log(
      `BASELINE: collecting history (0/${MIN_BASELINE} runs) — no anomaly check yet`
    )
    process.exit(0)
  }

  const records = fs
    .readFileSync(HISTORY_PATH, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l))

  if (records.length < MIN_BASELINE + 1) {
    console.log(
      `BASELINE: collecting history (${records.length}/${MIN_BASELINE + 1} runs) — no anomaly check yet`
    )
    process.exit(0)
  }

  const latest = records[records.length - 1]
  const baseline = records.slice(-(BASELINE_WINDOW + 1), -1)

  const p99s = baseline.map((r) => r.p99).filter((v) => v != null)
  const p99Mean = p99s.length ? mean(p99s) : null
  const p99Sd = p99s.length ? stddev(p99s) : null

  const errMean = mean(baseline.map((r) => r.errors ?? 0))
  const baselineClean = baseline.every((r) => (r.fail ?? 0) === 0)

  const alerts = []

  if (
    latest.p99 != null &&
    p99Mean != null &&
    p99Sd != null &&
    latest.p99 > p99Mean + 3 * p99Sd &&
    latest.p99 > 1.25 * p99Mean
  ) {
    alerts.push(
      `ALERT: p99 latency spike — ${latest.p99}ms vs baseline mean ${Math.round(p99Mean)}ms ` +
        `(sd=${Math.round(p99Sd)}ms, n=${baseline.length})`
    )
  }

  if ((latest.errors ?? 0) > 0 && errMean === 0) {
    alerts.push(
      `ALERT: request errors appeared — ${latest.errors} errors this run vs 0 across baseline (n=${baseline.length})`
    )
  }

  if ((latest.fail ?? 0) > 0 && baselineClean) {
    alerts.push(
      `ALERT: suite failures appeared — ${latest.fail} FAIL lines this run vs 0 across baseline (n=${baseline.length})`
    )
  }

  if (alerts.length) {
    for (const a of alerts) console.error(a)
    console.error(
      `FAIL: ${alerts.length} anomal${alerts.length === 1 ? 'y' : 'ies'} detected in nightly metrics`
    )
    process.exit(1)
  }

  const p99Summary =
    latest.p99 != null && p99Mean != null
      ? `p99 ${latest.p99}ms within baseline (mean ${Math.round(p99Mean)}ms, n=${baseline.length})`
      : `no p99 data this run (n=${baseline.length} baseline runs)`
  console.log(`OK: ${p99Summary}`)
  process.exit(0)
}

main()
