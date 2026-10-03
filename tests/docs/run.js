// Documentation validation tests — plain Node + global fetch.
// Verifies every user guide page exists, renders its title and steps,
// and is linked from the guide index. Runs as part of `test:nightly`.
//
// Target: TEST_BASE_URL, defaulting to the production deployment.
// Fails (exit 1) on the first failed assertion; prints PASS per check.

const BASE =
  process.env.TEST_BASE_URL ?? 'https://shift-scheduler-blond-two.vercel.app'

const GUIDES = [
  { path: '/guide/getting-started', title: 'Getting started' },
  { path: '/guide/dashboard', title: 'Dashboard' },
  { path: '/guide/inviting-employees', title: 'Inviting employees' },
  { path: '/guide/roster', title: 'Roster week view' },
  { path: '/guide/shifts', title: 'Adding, editing' },
  { path: '/guide/drag-and-drop', title: 'Drag-and-drop scheduling' },
  { path: '/guide/tour', title: 'Guided tour' },
  { path: '/guide/admin', title: 'Admin &amp; event history' },
]

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

async function main() {
  await check('guide index lists all guides', async () => {
    const { res, html } = await get('/guide')
    assert(res.status === 200, `status ${res.status}`)
    assert(html.includes('User guides'), 'missing "User guides" heading')
    for (const g of GUIDES) {
      assert(
        html.includes(`href="${g.path}"`),
        `index missing link to ${g.path}`
      )
    }
  })

  for (const g of GUIDES) {
    await check(`guide page renders: ${g.path}`, async () => {
      const { res, html } = await get(g.path)
      assert(res.status === 200, `status ${res.status}`)
      assert(html.includes('<h1'), `${g.path} missing h1 title`)
      assert(
        html.includes(g.title),
        `${g.path} missing title text "${g.title}"`
      )
    })

    await check(`guide has steps and nav: ${g.path}`, async () => {
      const { html } = await get(g.path)
      assert(html.includes('<ol'), `${g.path} missing numbered steps`)
      assert(
        html.includes('href="/guide"'),
        `${g.path} missing back-to-index nav`
      )
      assert(
        html.includes('href="/roster"'),
        `${g.path} missing back-to-roster nav`
      )
    })
  }

  await check('roster links to guides', async () => {
    const { html } = await get('/roster?week=2026-10-05')
    assert(html.includes('href="/guide"'), 'roster missing Guides link')
  })

  await check('dashboard links to guides', async () => {
    const { res, html } = await get('/dashboard')
    assert(
      [200, 307, 308].includes(res.status),
      `unexpected status ${res.status}`
    )
    if (res.status === 200) {
      assert(html.includes('href="/guide"'), 'dashboard missing guides link')
    }
  })

  await check('dashboard links to admin', async () => {
    const { res, html } = await get('/dashboard')
    assert(
      [200, 307, 308].includes(res.status),
      `unexpected status ${res.status}`
    )
    if (res.status === 200) {
      assert(html.includes('href="/admin"'), 'dashboard missing admin link')
    }
  })

  await check('admin page renders for managers', async () => {
    const { res, html } = await get('/admin')
    assert(
      [200, 307, 308].includes(res.status),
      `unexpected status ${res.status}`
    )
    if (res.status === 200) {
      assert(html.includes('<h1'), 'admin missing h1 title')
      assert(html.includes('Admin'), 'admin missing "Admin" title')
      assert(
        html.includes('Total events'),
        'admin missing analytics summary'
      )
    }
  })

  if (failures > 0) {
    console.error(`${failures} docs check(s) failed`)
    process.exit(1)
  }
  console.log('All docs checks passed')
}

main().catch((e) => {
  console.error('FAIL: docs runner crashed', e)
  process.exit(1)
})
