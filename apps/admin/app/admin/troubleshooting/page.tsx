import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireOwner } from '@shift-scheduler/shared/owner'
import { GuideHeader, Steps, Note } from '@shift-scheduler/shared/guide-components'

export const metadata = {
  title: 'Troubleshooting — Shift Scheduler admin',
}

// Owner-only: the ops runbook lives on the admin portal.
export default async function TroubleshootingPage() {
  try {
    await requireOwner()
  } catch {
    redirect('/dashboard')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          ← Back to admin
        </Link>
      </nav>
      <GuideHeader
        title="Troubleshooting"
        blurb="The ops runbook: how failures, slowdowns, and user reports get detected, diagnosed, and fixed."
      />

      <h2 className="mt-8 text-lg font-semibold">1. Detect</h2>
      <Steps
        items={[
          <>
            <strong>Nightly tests</strong> run at 11:15pm PT and catch
            regressions in docs, security headers, auth gates, and dependencies.
          </>,
          <>
            Turn on <strong>Vercel</strong> and <strong>Supabase</strong>{' '}
            alerting for downtime and error spikes — don&apos;t rely on users to
            tell you first.
          </>,
          <>
            User reports come to you directly for now. Ask for: the page URL,
            who was signed in, which team, when it started, and a screenshot.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">2. Triage</h2>
      <Steps
        items={[
          <>
            <strong>P1</strong> — app down, or wrong data for everyone. Drop
            everything.
          </>,
          <>
            <strong>P2</strong> — a feature is broken but the app works. Fix
            same day.
          </>,
          <>
            <strong>P3</strong> — cosmetic, or one user affected. Schedule it.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">3. Diagnose — in this order</h2>
      <Steps
        items={[
          <>
            <strong>Event history</strong> (/admin): what changed recently? A
            flag toggled, a role changed, an announcement deleted — the cause is
            usually the last change.
          </>,
          <>
            <strong>Feature flags</strong> (/admin/flags): is the feature even
            on for their org? The org ceiling is the #1 cause of &quot;works for
            me, broken for them.&quot;
          </>,
          <>
            <strong>Vercel runtime logs</strong>: stack traces for 500 errors —
            find the file and line.
          </>,
          <>
            <strong>Supabase logs</strong>: slow queries and RLS denials live
            here.
          </>,
          <>
            <strong>GitHub Actions</strong>: did the last deploy actually go
            green? A red build means production may be behind.
          </>,
        ]}
      />
      <Note tone="warn">
        &quot;I can&apos;t see X&quot; is almost always permissions: check the
        member&apos;s org role, the flag state for their org, and their team
        membership — in that order.
      </Note>

      <h2 className="mt-8 text-lg font-semibold">4. Mitigate first, fix second</h2>
      <Steps
        items={[
          <>
            <strong>Kill switch:</strong> turn the broken feature off in{' '}
            <Link href="/admin/flags" className="underline">
              /admin/flags
            </Link>{' '}
            (org or global). Instant, no deploy needed.
          </>,
          <>
            <strong>Rollback:</strong> redeploy the previous{' '}
            <strong>release branch</strong> in Vercel. One is cut on every
            production deploy, so there&apos;s always a known-good target.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">5. Fix</h2>
      <Steps
        items={[
          <>
            Hotfix branch → PR → green checks → merge → verify on production →
            release branch. Same flow as features, just faster.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">6. Learn</h2>
      <Steps
        items={[
          <>
            Write it in <strong>that day&apos;s change doc</strong> — every
            change gets its dated entry.
          </>,
          <>
            Add a <strong>regression check</strong> to the nightly suite so it
            can&apos;t come back quietly.
          </>,
          <>
            If it was config (a flag or role), note the correct setting so the
            next person doesn&apos;t repeat it.
          </>,
        ]}
      />
      <Note tone="tip">
        Most incidents are config, not code: a flag, a role, or a deploy. Check
        those before reading stack traces.
      </Note>
    </main>
  )
}
