// Light nightly load test — no external runner dependency.
// Uses Node's global fetch (which honors NODE_USE_ENV_PROXY, so it works
// behind the egress proxy) with a fixed pool of concurrent workers.
//
// Target: TEST_BASE_URL, defaulting to the production deployment.
// Profile is intentionally light: 10 workers for 30s against the roster
// page — enough to catch regressions, not to stress Vercel's Hobby tier.
// Fails (exit 1) on any error/non-2xx or p99 latency above the budget.

const BASE =
  process.env.TEST_BASE_URL ?? 'https://shift-scheduler-blond-two.vercel.app'
const URL = `${BASE}/roster?week=2026-10-05`
const WORKERS = Number(process.env.LOAD_WORKERS ?? 10)
const DURATION_MS = Number(process.env.LOAD_DURATION_MS ?? 30_000)
const P99_BUDGET_MS = Number(process.env.LOAD_P99_BUDGET_MS ?? 2000)

async function worker(deadline, stats) {
  while (Date.now() < deadline) {
    const start = Date.now()
    try {
      // NOTE: `Connection: close` — the egress proxy kills keep-alive pooled
      // connections, making alternating fetches fail with "fetch failed".
      const res = await fetch(URL, { headers: { Connection: 'close' } })
      await res.text()
      const ms = Date.now() - start
      stats.latencies.push(ms)
      if (res.status < 200 || res.status >= 300) stats.non2xx++
    } catch {
      stats.errors++
    }
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return -1
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

async function main() {
  const stats = { latencies: [], errors: 0, non2xx: 0 }
  const deadline = Date.now() + DURATION_MS
  await Promise.all(
    Array.from({ length: WORKERS }, () => worker(deadline, stats))
  )
  stats.latencies.sort((a, b) => a - b)
  const total = stats.latencies.length + stats.errors
  const p50 = percentile(stats.latencies, 50)
  const p99 = percentile(stats.latencies, 99)

  console.log(
    `requests=${total} errors=${stats.errors} non2xx=${stats.non2xx} ` +
      `p50=${p50}ms p99=${p99}ms`
  )

  let failed = false
  if (stats.errors > 0 || stats.non2xx > 0) {
    console.error(
      `FAIL: ${stats.errors} errors, ${stats.non2xx} non-2xx responses`
    )
    failed = true
  }
  if (p99 > P99_BUDGET_MS) {
    console.error(`FAIL: p99 ${p99}ms exceeds budget ${P99_BUDGET_MS}ms`)
    failed = true
  }
  if (!failed) console.log('PASS: load test within budget')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('FAIL: load runner crashed', e)
  process.exit(1)
})
