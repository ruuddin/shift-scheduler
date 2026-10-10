// Nightly metric collector — stage 1 of the anomaly-detection pipeline.
// Parses a saved nightly run log and appends one JSON record per run to
// tests/monitoring/history.jsonl. Plain Node, no dependencies.
//
// Input:  NIGHTLY_LOG env var, default tests/monitoring/last-run.log
// Output: appends {ts, requests, errors, non2xx, p50, p99, pass, fail}
//         to tests/monitoring/history.jsonl (created if missing).
// Exits 1 when the log is missing — never fabricates data.

const fs = require('fs')
const path = require('path')

const DIR = __dirname
const LOG_PATH = process.env.NIGHTLY_LOG ?? path.join(DIR, 'last-run.log')
const HISTORY_PATH = path.join(DIR, 'history.jsonl')

function main() {
  if (!fs.existsSync(LOG_PATH)) {
    console.error(
      `FAIL: nightly log not found at ${LOG_PATH} — ` +
        'save the nightly run output there first (see tests/monitoring/README.md)'
    )
    process.exit(1)
  }

  const log = fs.readFileSync(LOG_PATH, 'utf8')
  const lines = log.split('\n')

  // The load suite prints: requests=N errors=N non2xx=N p50=Nms p99=Nms
  // Take the last occurrence in case the log holds more than one run.
  let metrics = null
  const loadRe =
    /requests=(\d+)\s+errors=(\d+)\s+non2xx=(\d+)\s+p50=(\d+)ms\s+p99=(\d+)ms/
  for (const line of lines) {
    const m = line.match(loadRe)
    if (m) {
      metrics = {
        requests: Number(m[1]),
        errors: Number(m[2]),
        non2xx: Number(m[3]),
        p50: Number(m[4]),
        p99: Number(m[5]),
      }
    }
  }
  if (!metrics) {
    console.error(
      'WARN: no load-suite metric line found in log — recording pass/fail counts only'
    )
    metrics = { requests: null, errors: null, non2xx: null, p50: null, p99: null }
  }

  let pass = 0
  let fail = 0
  for (const line of lines) {
    const t = line.trimStart()
    if (t.startsWith('PASS:')) pass++
    else if (t.startsWith('FAIL:')) fail++
  }

  const record = {
    ts: new Date().toISOString(),
    requests: metrics.requests,
    errors: metrics.errors,
    non2xx: metrics.non2xx,
    p50: metrics.p50,
    p99: metrics.p99,
    pass,
    fail,
  }

  fs.appendFileSync(HISTORY_PATH, JSON.stringify(record) + '\n')
  console.log(`PASS: recorded nightly metrics -> ${HISTORY_PATH}`)
  console.log(`  ${JSON.stringify(record)}`)
}

main()
