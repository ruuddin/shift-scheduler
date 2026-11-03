// WebMCP roster-tool checks — plain Node + global fetch (no browser needed).
// Read-only and safe for nightly runs against production.
//
// Two layers:
//   1. HTTP contract of GET /api/webmcp/roster: week validation runs BEFORE
//      auth (so the 400 path is testable without a session), then 401
//      without a session. The 200 + manager paths need a real session and
//      are covered by the live-browser evaluation in docs/WEBMCP.md.
//   2. Static descriptor checks on lib/webmcp/roster-tool.ts: the safety
//      properties Chrome's guide requires (read-only hint, untrusted-content
//      hint, description budget, no emails/IDs in the output shaping).

/* eslint-disable @typescript-eslint/no-require-imports -- plain-Node test
   script (CommonJS, no bundler); the repo's other test scripts fetch over
   HTTP only, but this one also reads the shipped tool source. */
const fs = require('node:fs')
const path = require('node:path')

const BASE =
  process.env.TEST_BASE_URL ?? 'https://shift-scheduler-blond-two.vercel.app'

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

async function get(p) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { Connection: 'close' },
    redirect: 'follow',
  })
  const text = await res.text()
  return { res, text }
}

async function main() {
  // --- HTTP contract ---
  await check('roster route rejects a malformed week with 400 (before auth)', async () => {
    const { res } = await get('/api/webmcp/roster?week=not-a-date')
    assert(res.status === 400, `status ${res.status}`)
  })

  await check('roster route rejects a non-Monday-shaped week with 400', async () => {
    const { res } = await get('/api/webmcp/roster?week=2026-13-99')
    assert(res.status === 400, `status ${res.status}`)
  })

  await check('roster route returns 401 without a session', async () => {
    const { res } = await get('/api/webmcp/roster')
    assert(res.status === 401, `status ${res.status}`)
  })

  await check('roster route returns 401 without a session (valid week)', async () => {
    const { res } = await get('/api/webmcp/roster?week=2026-10-05')
    assert(res.status === 401, `status ${res.status}`)
  })

  // --- Descriptor safety properties (static, on the shipped source) ---
  const src = fs.readFileSync(
    path.join(__dirname, '../../lib/webmcp/roster-tool.ts'),
    'utf8'
  )

  await check('tool name is get_roster_week', async () => {
    assert(src.includes("name: 'get_roster_week'"), 'name not found')
  })

  await check('tool description is within Chrome\u2019s 500-char budget', async () => {
    const m = src.match(/const DESCRIPTION =\n?\s*"([^"]+)"/)
    assert(m, 'DESCRIPTION not found')
    assert(m[1].length <= 500, `description is ${m[1].length} chars`)
  })

  await check('tool is marked readOnlyHint', async () => {
    assert(src.includes('readOnlyHint: true'), 'readOnlyHint missing')
  })

  await check('tool output is marked untrustedContentHint (roster text is UGC)', async () => {
    assert(src.includes('untrustedContentHint: true'), 'untrustedContentHint missing')
  })

  await check('input schema closes additional properties', async () => {
    assert(src.includes('additionalProperties: false'), 'additionalProperties not false')
  })

  await check('output shaping keeps no emails or row IDs', async () => {
    const shaping = src.slice(src.indexOf('type RosterApiMember'))
    assert(!shaping.includes('email'), 'email leaks into output shaping')
    assert(!/\.id\b/.test(shaping), 'row id leaks into output shaping')
  })

  await check('client validates week format before fetching', async () => {
    assert(
      src.includes("if (week && !WEEK_RE.test(week))"),
      'client-side week validation missing'
    )
  })

  console.log(failures === 0 ? 'ALL WEBMCP CHECKS PASSED' : `${failures} FAILURES`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(`FATAL: ${e.message}`)
  process.exit(1)
})
