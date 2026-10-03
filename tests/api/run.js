// API contract tests — plain Node + global fetch (no browser needed).
// Validates the app's API routes and auth redirect behavior.
// Read-only and safe for nightly runs against production.
//
// Target: TEST_BASE_URL, defaulting to the production deployment.

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

async function get(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Connection: 'close', ...(opts.headers ?? {}) },
    redirect: opts.redirect ?? 'follow',
  })
  const text = await res.text()
  return { res, text }
}

async function main() {
  await check('/api/version returns a valid deploy SHA', async () => {
    const { res, text } = await get('/api/version')
    assert(res.status === 200, `status ${res.status}`)
    const body = JSON.parse(text)
    assert(
      typeof body.sha === 'string' && /^[0-9a-f]{40}$/.test(body.sha),
      `unexpected sha: ${body.sha}`
    )
  })

  await check('unauthenticated /dashboard redirects to /login', async () => {
    const { res } = await get('/dashboard', { redirect: 'manual' })
    assert([307, 308].includes(res.status), `status ${res.status}`)
    const loc = res.headers.get('location') ?? ''
    assert(loc.includes('/login'), `redirected to ${loc}`)
  })

  await check('unauthenticated /admin redirects (not 200)', async () => {
    const { res } = await get('/admin', { redirect: 'manual' })
    assert(res.status !== 200, `expected redirect, got ${res.status}`)
  })

  await check('unauthenticated /invite redirects (not 200)', async () => {
    const { res } = await get('/invite', { redirect: 'manual' })
    assert(res.status !== 200, `expected redirect, got ${res.status}`)
  })

  await check('login page renders sign-in form', async () => {
    const { res, text } = await get('/login')
    assert(res.status === 200, `status ${res.status}`)
    assert(text.includes('Sign in'), 'missing "Sign in"')
    assert(text.includes('type="email"'), 'missing email input')
    assert(text.includes('type="password"'), 'missing password input')
  })

  await check('signup page renders team creation form', async () => {
    const { res, text } = await get('/signup')
    assert(res.status === 200, `status ${res.status}`)
    assert(text.includes('Create your team'), 'missing "Create your team"')
    assert(text.includes('Team name'), 'missing team name field')
  })

  if (failures > 0) {
    console.error(`${failures} API check(s) failed`)
    process.exit(1)
  }
  console.log('All API checks passed.')
}

main().catch((e) => {
  console.error('API tests crashed:', e.message)
  process.exit(1)
})
