// Speed / stress / soak performance tests — plain Node + global fetch
// (no test frameworks), following the style of tests/smoke/run.js and
// tests/load/run.js.
//
// Three phases, all read-only GETs against public pages:
//   1. speed  — per-route latency (avg/p95) over a handful of samples.
//   2. stress — concurrency ramp [1,5,10,15,20]; finds the highest clean
//              concurrency level (no errors, no non-2xx).
//   3. soak   — sustained ~5 rps for 60s; asserts stability over time.
//
// Every knob is env-tunable. Bounded by design: a default run issues
// ~475 requests total, comparable to the existing nightly load probe.
//
// Target: TEST_BASE_URL, defaulting to the production deployment.
// Fails (exit 1) on any failed check.

const BASE =
  process.env.TEST_BASE_URL ?? 'https://shift-scheduler-blond-two.vercel.app'

// --- tunables ---------------------------------------------------------------
const SPEED_ROUTES = ['/', '/login', '/signup', '/guide', '/guide/getting-started']
const SPEED_SAMPLES = Number(process.env.SPEED_SAMPLES ?? 5)
const SPEED_P95_BUDGET_MS = Number(process.env.SPEED_P95_BUDGET_MS ?? 3000)

const STRESS_LEVELS = (process.env.STRESS_LEVELS ?? '1,5,10,15,20')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0)
const STRESS_REQS_PER_LEVEL = Number(process.env.STRESS_REQS_PER_LEVEL ?? 30)
const STRESS_ROUTES = ['/login', '/guide']
const STRESS_MIN_CLEAN_LEVEL = Number(process.env.STRESS_MIN_CLEAN_LEVEL ?? 10)

const SOAK_RPS = Number(process.env.SOAK_RPS ?? 5)
const SOAK_DURATION_MS = Number(process.env.SOAK_DURATION_MS ?? 60_000)
const SOAK_P99_BUDGET_MS = Number(process.env.SOAK_P99_BUDGET_MS ?? 6000)
const SOAK_ROUTES = ['/', '/guide']

// --- harness ----------------------------------------------------------------
let failures = 0

async function check(name, fn) {
  try {
    await fn()
    console.log(`PASS: ${name}`)
  } catch (e) {
    failures++
    console.error(`FAIL: ${name} — ${e.message}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function percentile(sorted, p) {
  if (!sorted.length) return -1
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

function avg(arr) {
  if (!arr.length) return -1
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

// Single timed GET. Returns { ms } on 2xx/3xx, or { error } otherwise.
// NOTE: `Connection: close` — the egress proxy kills keep-alive pooled
// connections, making every second fetch() fail with "fetch failed".
async function timedGet(path) {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Connection: 'close' },
    })
    await res.text() // drain the body so timing reflects full response
    const ms = Date.now() - start
    if (res.status < 200 || res.status >= 400) {
      return { error: `status ${res.status}` }
    }
    return { ms }
  } catch (e) {
    return { error: e.message }
  }
}

function summarize(results) {
  const latencies = results
    .filter((r) => r.ms !== undefined)
    .map((r) => r.ms)
    .sort((a, b) => a - b)
  const errors = results.filter((r) => r.error !== undefined)
  return { latencies, errors, p50: percentile(latencies, 50), p95: percentile(latencies, 95), p99: percentile(latencies, 99) }
}

// --- phase 1: speed ----------------------------------------------------------
async function speedPhase() {
  console.log('\n-- speed: per-route latency --')
  for (const route of SPEED_ROUTES) {
    const results = []
    for (let i = 0; i < SPEED_SAMPLES; i++) {
      results.push(await timedGet(route))
    }
    const { latencies, errors, p95 } = summarize(results)
    console.log(
      `  ${route}: n=${results.length} avg=${avg(latencies)}ms p95=${p95}ms errors=${errors.length}`
    )
    await check(`speed: ${route} p95 under ${SPEED_P95_BUDGET_MS}ms`, async () => {
      assert(errors.length === 0, `${errors.length} failed requests`)
      assert(p95 <= SPEED_P95_BUDGET_MS, `p95 ${p95}ms`)
    })
  }
}

// --- phase 2: stress ---------------------------------------------------------
async function stressPhase() {
  console.log('\n-- stress: concurrency ramp --')
  let maxClean = 0
  for (const level of STRESS_LEVELS) {
    // Fire STRESS_REQS_PER_LEVEL requests in chunks of `level` concurrent.
    const results = []
    let routeIdx = 0
    for (let i = 0; i < STRESS_REQS_PER_LEVEL; i += level) {
      const chunk = []
      for (let j = 0; j < level && i + j < STRESS_REQS_PER_LEVEL; j++) {
        chunk.push(timedGet(STRESS_ROUTES[routeIdx++ % STRESS_ROUTES.length]))
      }
      results.push(...(await Promise.all(chunk)))
    }
    const { latencies, errors, p99 } = summarize(results)
    const clean = errors.length === 0
    console.log(
      `  concurrency=${level}: n=${results.length} p99=${p99}ms errors=${errors.length} ${clean ? 'clean' : 'DIRTY'}`
    )
    if (clean) {
      maxClean = level
    } else {
      console.log(`  stopping ramp at ${level} (errors observed)`)
      break
    }
  }
  console.log(`  max clean concurrency: ${maxClean}`)
  await check(`stress: clean at ${STRESS_MIN_CLEAN_LEVEL}+ concurrent`, async () => {
    assert(
      maxClean >= STRESS_MIN_CLEAN_LEVEL,
      `max clean concurrency was ${maxClean}`
    )
  })
}

// --- phase 3: soak -----------------------------------------------------------
async function soakPhase() {
  console.log(
    `\n-- soak: ${SOAK_RPS} rps for ${Math.round(SOAK_DURATION_MS / 1000)}s --`
  )
  const intervalMs = 1000 / SOAK_RPS
  const deadline = Date.now() + SOAK_DURATION_MS
  const results = []
  let routeIdx = 0
  while (Date.now() < deadline) {
    const tick = Date.now()
    results.push(await timedGet(SOAK_ROUTES[routeIdx++ % SOAK_ROUTES.length]))
    const elapsed = Date.now() - tick
    if (elapsed < intervalMs) {
      await new Promise((r) => setTimeout(r, intervalMs - elapsed))
    }
  }
  const { latencies, errors, p50, p99 } = summarize(results)
  console.log(
    `  n=${results.length} p50=${p50}ms p99=${p99}ms errors=${errors.length}`
  )
  if (errors.length > 0) {
    console.log(`  first error: ${errors[0].error}`)
  }
  await check('soak: zero errors under sustained load', async () => {
    assert(errors.length === 0, `${errors.length} errors`)
  })
  await check(`soak: p99 under ${SOAK_P99_BUDGET_MS}ms`, async () => {
    assert(p99 <= SOAK_P99_BUDGET_MS, `p99 ${p99}ms`)
  })
}

// --- main --------------------------------------------------------------------
async function main() {
  console.log(`perf tests against ${BASE}`)
  await speedPhase()
  await stressPhase()
  await soakPhase()

  console.log('')
  if (failures > 0) {
    console.error(`FAIL: ${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('PASS: perf tests (speed/stress/soak) within budget')
}

main().catch((e) => {
  console.error('FAIL: perf runner crashed', e)
  process.exit(1)
})
