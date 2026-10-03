// Security tests — plain Node + global fetch, plus a local npm audit.
// Runs as part of `test:nightly`.
//
// Checks:
//   1. Security headers are present on HTML responses
//      (X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
//       Permissions-Policy) and X-Powered-By is not leaked.
//   2. Auth-gated pages (/admin, /roster, /invite) don't serve private
//      content to anonymous visitors: in live mode they redirect to
//      /login; in preview mode they render the demo with the preview
//      banner (no real user data exists there).
//   3. `npm audit` reports no high or critical vulnerabilities in
//      dependencies.
//   4. No secrets committed to the repo (API keys, tokens, private keys).
//   5. Static analysis (eslint-plugin-security) is part of `npm run lint`,
//      which CI runs as a required check on every PR.
//
// Target: TEST_BASE_URL, defaulting to the production deployment.
// Fails (exit 1) if any check fails; prints PASS per check.

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'

const BASE =
  process.env.TEST_BASE_URL ?? 'https://shift-scheduler-blond-two.vercel.app'

// Repo root is two levels up from tests/security/run.js
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')

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

async function get(urlPath) {
  // NOTE: `Connection: close` — the egress proxy kills keep-alive pooled
  // connections, making every second fetch() fail with "fetch failed".
  const res = await fetch(`${BASE}${urlPath}`, {
    headers: { Connection: 'close' },
    redirect: 'manual',
  })
  const html = await res.text().catch(() => '')
  return { res, html }
}

function header(res, name) {
  return res.headers.get(name)
}

async function main() {
  await check('security headers present', async () => {
    const { res } = await get('/login')
    assert(res.status === 200, `status ${res.status}`)
    const xcto = header(res, 'x-content-type-options')
    assert(
      xcto && xcto.toLowerCase() === 'nosniff',
      `X-Content-Type-Options missing or wrong: ${xcto}`
    )
    const xfo = header(res, 'x-frame-options')
    assert(
      xfo && ['deny', 'sameorigin'].includes(xfo.toLowerCase()),
      `X-Frame-Options missing or wrong: ${xfo}`
    )
    const rp = header(res, 'referrer-policy')
    assert(rp, 'Referrer-Policy missing')
    const pp = header(res, 'permissions-policy')
    assert(pp, 'Permissions-Policy missing')
  })

  await check('X-Powered-By not leaked', async () => {
    const { res } = await get('/login')
    const xpb = header(res, 'x-powered-by')
    assert(!xpb, `X-Powered-By leaked: ${xpb}`)
  })

  await check('HSTS enforced', async () => {
    // Strict-Transport-Security is set by Vercel at the edge, not by
    // Next.js — so it only appears on deployed URLs, never localhost.
    if (BASE.includes('localhost') || BASE.includes('127.0.0.1')) {
      console.log('  (skipped on localhost — HSTS is set by Vercel at the edge)')
      return
    }
    const { res } = await get('/login')
    const hsts = header(res, 'strict-transport-security')
    assert(
      hsts && hsts.includes('max-age='),
      `Strict-Transport-Security missing: ${hsts}`
    )
  })

  for (const urlPath of ['/admin', '/roster', '/invite']) {
    await check(`auth gate: ${urlPath} not open to anonymous visitors`, async () => {
      const { res, html } = await get(urlPath)
      if ([307, 308].includes(res.status)) {
        const loc = header(res, 'location') || ''
        assert(
          loc.includes('/login') || loc.includes('/dashboard'),
          `${urlPath} redirects to unexpected location: ${loc}`
        )
        return
      }
      // Preview mode (no Supabase keys): pages render demo content.
      // That is expected — but it must carry the preview banner and no
      // real user data.
      assert(res.status === 200, `unexpected status ${res.status}`)
      assert(
        html.includes('Preview mode'),
        `${urlPath} renders 200 without redirect and without preview banner`
      )
    })
  }

  await check('npm audit: no high/critical vulnerabilities', async () => {
    let out
    try {
      out = execSync('npm audit --json', {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      // npm audit exits non-zero when vulnerabilities are found; the JSON
      // is still on stdout.
      out = e.stdout || ''
    }
    assert(out, 'npm audit produced no output')
    const report = JSON.parse(out)
    const meta = report.metadata?.vulnerabilities ?? {}
    const high = meta.high ?? 0
    const critical = meta.critical ?? 0
    assert(
      high === 0 && critical === 0,
      `${critical} critical, ${high} high vulnerabilities found`
    )
  })

  await check('no secrets committed to the repo', async () => {
    // List tracked files (respects .gitignore) and scan for secret patterns.
    const files = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .filter((f) => !f.endsWith('.md'))
    const patterns = [
      /sk-live-[A-Za-z0-9]+/, // Stripe live secret key
      /sk-ant-[A-Za-z0-9-]+/, // Anthropic API key
      /xox[baprs]-[A-Za-z0-9-]+/, // Slack token
      /ghp_[A-Za-z0-9]{20,}/, // GitHub personal access token
      /AKIA[0-9A-Z]{16}/, // AWS access key id
      /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, // private keys
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, // JWTs
    ]
    const hits = []
    for (const f of files) {
      let content
      try {
        content = readFileSync(path.join(REPO_ROOT, f), 'utf8')
      } catch {
        continue // binary file
      }
      for (const re of patterns) {
        if (re.test(content)) {
          hits.push(`${f} matches ${re}`)
          break
        }
      }
    }
    assert(hits.length === 0, `possible secrets found:\n${hits.join('\n')}`)
  })

  if (failures > 0) {
    console.error(`${failures} security check(s) failed`)
    process.exit(1)
  }
  console.log('All security checks passed')
}

main().catch((e) => {
  console.error('FAIL: security runner crashed', e)
  process.exit(1)
})
