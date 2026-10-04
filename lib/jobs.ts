// Background jobs — registry, runner, and run history.
//
// Every recurring/background task is registered in JOBS with a name,
// description, and frequency (NFR). Runs execute through runJob(), which
// records start/finish, status, and output in job_runs so the admin
// dashboard (/admin/jobs) can show status, history, and frequencies.
//
// Triggering: the /api/cron/jobs route executes jobs (Vercel Cron or the
// system cron hits it with CRON_SECRET). Jobs are idempotent — the daily
// analytics rollup upserts, so a re-run never double-counts.

import { getReader, getWriter } from './db'

export type JobStatus = 'running' | 'succeeded' | 'failed'

export type JobDefinition = {
  key: string
  description: string
  frequency: string
  run: () => Promise<string> // returns a human-readable summary
}

export type JobInfo = {
  job_key: string
  description: string
  frequency: string
  enabled: boolean
  last_run: {
    status: JobStatus
    started_at: string
    finished_at: string | null
    output: string | null
  } | null
  run_count_30d: number
}

export type JobRunRecord = {
  id: string
  job_key: string
  started_at: string
  finished_at: string | null
  status: JobStatus
  output: string | null
  error: string | null
  triggered_by: string
}

const ANALYTICS_WINDOW_DAYS = 90

/** Nightly analytics rollup: per-team, per-day active users, last 90 days. */
async function runAnalyticsRollup(): Promise<string> {
  const reader = await getReader()
  const writer = await getWriter()

  const since = new Date(
    Date.now() - ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
  const sinceDay = since.toISOString().slice(0, 10)

  // Pull distinct (day, team, actor) triples from the event log.
  // Paged because the window can be large.
  const seen = new Map<string, { users: Set<string>; managers: Set<string>; employees: Set<string> }>()
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await reader
      .from('events')
      .select('created_at, team_id, actor_id, actor_role')
      .gte('created_at', since.toISOString())
      .not('team_id', 'is', null)
      .not('actor_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`events read failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const e of data as {
      created_at: string
      team_id: string
      actor_id: string
      actor_role: string | null
    }[]) {
      const day = e.created_at.slice(0, 10)
      const k = `${day}:${e.team_id}`
      let bucket = seen.get(k)
      if (!bucket) {
        bucket = { users: new Set(), managers: new Set(), employees: new Set() }
        seen.set(k, bucket)
      }
      bucket.users.add(e.actor_id)
      if (e.actor_role === 'manager') bucket.managers.add(e.actor_id)
      else bucket.employees.add(e.actor_id)
    }
    if (data.length < pageSize) break
    from += pageSize
  }

  // Upsert one row per (day, team).
  let rows = 0
  const batch: {
    day: string
    team_id: string
    active_users: number
    managers_active: number
    employees_active: number
  }[] = []
  for (const [k, b] of seen) {
    const [day, team_id] = k.split(':')
    batch.push({
      day,
      team_id,
      active_users: b.users.size,
      managers_active: b.managers.size,
      employees_active: b.employees.size,
    })
  }
  const CHUNK = 200
  for (let i = 0; i < batch.length; i += CHUNK) {
    const { error } = await writer
      .from('analytics_daily_active')
      .upsert(batch.slice(i, i + CHUNK), { onConflict: 'day,team_id' })
    if (error) throw new Error(`rollup write failed: ${error.message}`)
    rows += Math.min(CHUNK, batch.length - i)
  }

  // Prune anything older than the 90-day window.
  await writer.from('analytics_daily_active').delete().lt('day', sinceDay)

  return `Rolled up ${rows} day-team rows across ${seen.size} active day-teams; pruned rows before ${sinceDay}.`
}

export const JOBS: Record<string, JobDefinition> = {
  'analytics-daily-rollup': {
    key: 'analytics-daily-rollup',
    description:
      'Aggregates per-team, per-day active users from the event log for the last 90 days.',
    frequency: 'daily',
    run: runAnalyticsRollup,
  },
}

export const ALL_JOB_KEYS = Object.keys(JOBS)

function dbAvailable(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL
}

/** Execute one job, recording the run. Safe to call for unknown keys. */
export async function runJob(
  key: string,
  triggeredBy = 'cron'
): Promise<{ status: JobStatus; output: string }> {
  const job = JOBS[key]
  if (!job) throw new Error(`Unknown job: ${key}`)

  if (!dbAvailable()) {
    return { status: 'succeeded', output: 'Preview mode — no database, nothing to roll up.' }
  }

  const writer = await getWriter()
  const { data: runRow, error: insertError } = await writer
    .from('job_runs')
    .insert({ job_key: key, status: 'running', triggered_by: triggeredBy })
    .select('id')
    .single()
  if (insertError || !runRow) {
    throw new Error(`Could not record job run: ${insertError?.message}`)
  }

  const started = Date.now()
  try {
    const output = await job.run()
    await writer
      .from('job_runs')
      .update({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        output: `${output} (${((Date.now() - started) / 1000).toFixed(1)}s)`,
      })
      .eq('id', (runRow as { id: string }).id)
    return { status: 'succeeded', output }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await writer
      .from('job_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq('id', (runRow as { id: string }).id)
    return { status: 'failed', output: message }
  }
}

/** Registry + last-run status for the admin dashboard. */
export async function getJobsOverview(): Promise<JobInfo[]> {
  const result: JobInfo[] = []
  for (const key of ALL_JOB_KEYS) {
    const job = JOBS[key]
    const info: JobInfo = {
      job_key: key,
      description: job.description,
      frequency: job.frequency,
      enabled: true,
      last_run: null,
      run_count_30d: 0,
    }
    if (dbAvailable()) {
      try {
        const reader = await getReader()
        const { data: meta } = await reader
          .from('jobs')
          .select('enabled')
          .eq('job_key', key)
          .maybeSingle()
        if (meta) info.enabled = meta.enabled as boolean

        const { data: last } = await reader
          .from('job_runs')
          .select('status, started_at, finished_at, output')
          .eq('job_key', key)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (last) {
          info.last_run = {
            status: last.status as JobStatus,
            started_at: last.started_at as string,
            finished_at: last.finished_at as string | null,
            output: last.output as string | null,
          }
        }

        const since = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString()
        const { count } = await reader
          .from('job_runs')
          .select('id', { count: 'exact', head: true })
          .eq('job_key', key)
          .gte('started_at', since)
        info.run_count_30d = count ?? 0
      } catch {
        // fall through with defaults
      }
    }
    result.push(info)
  }
  return result
}

export async function getJobRuns(
  key: string,
  limit = 30
): Promise<JobRunRecord[]> {
  if (!dbAvailable()) return []
  try {
    const reader = await getReader()
    const { data, error } = await reader
      .from('job_runs')
      .select(
        'id, job_key, started_at, finished_at, status, output, error, triggered_by'
      )
      .eq('job_key', key)
      .order('started_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as JobRunRecord[]
  } catch {
    return []
  }
}

export async function setJobEnabled(key: string, enabled: boolean): Promise<void> {
  if (!dbAvailable()) throw new Error('No database in preview mode')
  const writer = await getWriter()
  const { error } = await writer
    .from('jobs')
    .update({ enabled })
    .eq('job_key', key)
  if (error) throw new Error(error.message)
}
