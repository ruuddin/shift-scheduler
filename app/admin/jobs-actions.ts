'use server'

import { logEventAction } from '@/lib/event-actions'
import { requireOwner } from '@/lib/owner'
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

async function requireOwnerGate() {
  // Owner-only: the /admin portal is the SaaS owner's console.
  return requireOwner()
}

export async function getJobsAction(): Promise<{
  jobs: JobInfo[]
  preview: boolean
}> {
  if (isPreview()) {
    const jobs = await getJobsOverview()
    return { jobs, preview: true }
  }
  await requireOwnerGate()
  return { jobs: await getJobsOverview(), preview: false }
}

export async function getJobRunsAction(
  key: string
): Promise<JobRunRecord[]> {
  if (isPreview()) return []
  await requireOwnerGate()
  return getJobRuns(key, 30)
}

/** Manager manually triggers a job run from the admin dashboard. */
export async function runJobAction(
  key: string
): Promise<{ status: string; output: string }> {
  const { email: userEmail } = await requireOwnerGate()
  const result = await runJob(key, userEmail ?? 'manual')
  await logEventAction({
    eventType: 'job.run',
    entityType: 'job',
    entityId: key,
    metadata: {
      job_key: key,
      status: result.status,
      triggered_by: userEmail ?? 'manual',
    },
  })
  return result
}

export async function setJobEnabledAction(
  key: string,
  enabled: boolean
): Promise<{ ok: true }> {
  await requireOwnerGate()
  await setJobEnabled(key, enabled)
  return { ok: true }
}
