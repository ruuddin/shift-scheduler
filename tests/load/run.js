// Use-case load test — no external runner dependency.
// Simulates realistic actor journeys with weighted scenarios, using Node's
// global fetch (honors NODE_USE_ENV_PROXY for the egress proxy).
//
// Actors & use cases:
//   - Visitor (50%): lands on /, browses to login/signup, reads guides.
//     This is the public funnel — first impression performance.
//   - Prospective manager (25%): signup page, teams guide, auth guide.
//     Measures the signup-funnel page performance.
//   - Prospective employee (25%): login page, getting-started guide.
//     Measures the join-funnel page performance.
//   - Auth gates (every worker, interleaved): /dashboard, /roster, /admin
//     must redirect anonymous users quickly. This is the employee/manager
//     entry point — slow gates mean slow app for everyone.
//
// NOTE: fully authenticated scenarios (signed-in roster/admin under load)
// can't run from this VM — the egress proxy blocks direct Supabase Auth API
// access, so sessions can't be minted here. Those flows are covered by
// per-PR browser verification. This suite measures what the nightly runner
// can reach: public surface + gate speed.
//
// Target: TEST_BASE_URL, defaulting to production.
// Fails (exit 1) on any error/non-2xx or p99 above budget.

const BASE =
  process.env.TEST_BASE_URL ?? 'https://shift-scheduler-blond-two.vercel.app'
const WORKERS = Number(process.env.LOAD_WORKERS ?? 10)
const DURATION_MS = Number(process.env.LOAD_DURATION_MS ?? 30_000)
const P99_BUDGET_MS = Number(process.env.LOAD_P99_BUDGET_MS ?? 6000)

// Each scenario is a weighted user journey: a sequence of page hits.
const SCENARIOS = [
  {
    actor: 'visitor',
    weight: 50,
    steps: ['/', '/login', '/guide', '/guide/getting-started'],
  },
  {
    actor: 'prospective-manager',
    weight: 25,
    steps: ['/signup', '/guide/teams', '/guide/auth', '/guide/inviting-employees'],
  },
  {
    actor: 'prospective-employee',
    weight: 25,
    steps: ['/login', '/guide/getting-started', '/guide/dashboard'],
  },
]

// Auth-gate probes, interleaved by every worker.
const GATE_PATHS = ['/dashboard', '/roster', '/admin']

function pickScenario() {
  const total = SCENARIOS.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const s of SCENARIOS) {
    r -= s.weight
    if (r <= 0) return s
  }
  return SCENARIOS[0]
}

async function hit(path, stats, actor) {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Connection: 'close' },
    })
    await res.text()
    const ms = Date.now() - start
    stats.latencies.push(ms)
    stats.byActor[actor] = stats.byActor[actor] || { n: 0, slow: 0 }
    stats.byActor[actor].n++
    if (ms > P99_BUDGET_MS) stats.byActor[actor].slow++
    if (res.status < 200 || res.status >= 400) stats.non2xx++
  } catch {
    stats.errors++
  }
}

async function worker(deadline, stats) {
  let gateIdx = 0
  while (Date.now() < deadline) {
    // Run a full actor journey.
    const scenario = pickScenario()
    for (const step of scenario.steps) {
      if (Date.now() >= deadline) break
      await hit(step, stats, scenario.actor)
    }
    // Interleave an auth-gate probe (anonymous must be redirected fast).
    const gate = GATE_PATHS[gateIdx++ % GATE_PATHS.length]
    await hit(gate, stats, 'auth-gate')
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return -1
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

async function main() {
  const stats = { latencies: [], errors: 0, non2xx: 0, byActor: {} }
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
  for (const [actor, s] of Object.entries(stats.byActor)) {
    console.log(`  ${actor}: ${s.n} hits, ${s.slow} over budget`)
  }

  let failed = false
  if (stats.errors > 0 || stats.non2xx > 0) {
    console.error(`FAIL: ${stats.errors} errors, ${stats.non2xx} non-2xx responses`)
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
