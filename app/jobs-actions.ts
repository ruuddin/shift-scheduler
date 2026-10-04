'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveTeam, getMyTeams } from '@/app/team-actions'
import { logEventAction } from '@/app/event-actions'
import {
  getJobsOverview,
  getJobRuns,
  runJob,
  setJobEnabled,
  type JobInfo,
  type JobRunRecord,
} from '@/lib/jobs'

function isPreview(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
}

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const activeTeam = await getActiveTeam()
  const teams = await getMyTeams()
  const role = teams.find((t) => t.id === activeTeam?.id)?.role
  if (!activeTeam || role !== 'manager') throw new Error('Not authorized')
  return { user, activeTeam }
}

export async function getJobsAction(): Promise<{
  jobs: JobInfo[]
  preview: boolean
}> {
  if (isPreview()) {
    const jobs = await getJobsOverview()
    return { jobs, preview: true }
  }
  await requireManager()
  return { jobs: await getJobsOverview(), preview: false }
}

export async function getJobRunsAction(
  key: string
): Promise<JobRunRecord[]> {
  if (isPreview()) return []
  await requireManager()
  return getJobRuns(key, 30)
}

/** Manager manually triggers a job run from the admin dashboard. */
export async function runJobAction(
  key: string
): Promise<{ status: string; output: string }> {
  const { user } = await requireManager()
  const result = await runJob(key, user.email ?? 'manual')
  await logEventAction({
    eventType: 'job.run',
    entityType: 'job',
    entityId: key,
    metadata: {
      job_key: key,
      status: result.status,
      triggered_by: user.email ?? 'manual',
    },
  })
  return result
}

export async function setJobEnabledAction(
  key: string,
  enabled: boolean
): Promise<{ ok: true }> {
  await requireManager()
  await setJobEnabled(key, enabled)
  return { ok: true }
}
