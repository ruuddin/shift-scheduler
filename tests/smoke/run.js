// Nightly smoke tests — plain Node + global fetch (no browser needed).
// Node's fetch honors NODE_USE_ENV_PROXY, so this works behind the egress
// proxy where Playwright's HTTP client cannot connect.
//
// Target: TEST_BASE_URL, defaulting to the production deployment.
// Fails (exit 1) on the first failed assertion; prints PASS per check.

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

async function get(path) {
  // NOTE: `Connection: close` — the egress proxy kills keep-alive pooled
  // connections, making every second fetch() fail with "fetch failed".
  const res = await fetch(`${BASE}${path}`, {
    headers: { Connection: 'close' },
  })
  const html = await res.text()
  return { res, html }
}

function ptHour() {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
  )
}

async function main() {
  await check('root redirects to the roster', async () => {
    const { res, html } = await get('/')
    assert(res.status === 200, `status ${res.status}`)
    assert(res.url.includes('/roster'), `landed at ${res.url}`)
    assert(html.includes('Roster'), 'missing "Roster" heading')
  })

  await check('roster week renders demo schedule', async () => {
    const { res, html } = await get('/roster?week=2026-10-05')
    assert(res.status === 200, `status ${res.status}`)
    assert(html.includes('Ben Barista'), 'missing demo employee Ben Barista')
    assert(html.includes('Cara Cashier'), 'missing demo employee Cara Cashier')
  })

  await check('roster renders mobile day-view markup', async () => {
    const { html } = await get('/roster?week=2026-10-05')
    assert(html.includes('data-tour-m="grid"'), 'missing mobile day-view container')
    assert(html.includes('Pick a day'), 'missing mobile day picker')
    assert(html.includes('+ Add'), 'missing mobile add-shift button')
  })

  await check('login page loads', async () => {
    const { res, html } = await get('/login')
    assert(res.status === 200, `status ${res.status}`)
    assert(html.includes('type="password"'), 'missing password field')
  })

  await check('dashboard is reachable', async () => {
    const { res } = await get('/dashboard')
    // 200 (preview mode) or a redirect to /login (live auth) are both healthy
    assert(
      [200, 307, 308].includes(res.status),
      `unexpected status ${res.status}`
    )
  })

  const h = ptHour()
  if (h >= 23 || h < 1) {
    await check('maintenance banner shows inside the nightly window', async () => {
      const { res, html } = await get('/roster?week=2026-10-05')
      assert(res.status === 200, `status ${res.status}`)
      assert(html.includes('role="status"'), 'banner not rendered')
      assert(
        html.includes('Nightly maintenance in progress'),
        'banner text missing'
      )
    })
  } else {
    console.log('SKIP: maintenance banner (outside 11pm–1am PT window)')
  }

  if (failures > 0) {
    console.error(`${failures} smoke check(s) failed`)
    process.exit(1)
  }
  console.log('All smoke checks passed')
}

main().catch((e) => {
  console.error('FAIL: smoke runner crashed', e)
  process.exit(1)
})
