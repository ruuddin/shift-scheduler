// Cron entrypoint — runs one or all registered background jobs.
//
// Triggered by Vercel Cron or the system scheduler. Auth: either
//   Authorization: Bearer <CRON_SECRET>
// or ?secret=<CRON_SECRET> (Vercel Cron supports query params).
// Without CRON_SECRET set, only Vercel's own cron invocations
// (x-vercel-cron header) are accepted.

import { NextRequest, NextResponse } from 'next/server'
import { ALL_JOB_KEYS, runJob } from '@/lib/jobs'
import { logEventAction } from '@/app/event-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  return req.nextUrl.searchParams.get('secret') === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const only = req.nextUrl.searchParams.get('job')
  const keys = only ? [only] : ALL_JOB_KEYS
  const results: Record<string, { status: string; output: string }> = {}

  for (const key of keys) {
    try {
      const r = await runJob(key, 'cron')
      results[key] = r
      await logEventAction({
        eventType: 'job.run',
        entityType: 'job',
        entityId: key,
        metadata: { job_key: key, status: r.status },
      }).catch(() => {})
    } catch (e) {
      results[key] = {
        status: 'failed',
        output: e instanceof Error ? e.message : String(e),
      }
    }
  }

  return NextResponse.json({ ok: true, results })
}
