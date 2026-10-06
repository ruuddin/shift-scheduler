'use client'

import { useState } from 'react'
import {
  getJobRunsAction,
  runJobAction,
  setJobEnabledAction,
} from '@/app/admin/jobs-actions'
import type { JobInfo, JobRunRecord } from '@shift-scheduler/shared/jobs'

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'succeeded'
      ? 'bg-green-500'
      : status === 'failed'
        ? 'bg-red-500'
        : 'bg-amber-500'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="capitalize">{status}</span>
    </span>
  )
}

function JobCard({
  job,
  onChanged,
}: {
  job: JobInfo
  onChanged: () => void
}) {
  const [runs, setRuns] = useState<JobRunRecord[] | null>(null)
  const [showRuns, setShowRuns] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function toggleRuns() {
    if (!showRuns && runs === null) {
      setRuns(await getJobRunsAction(job.job_key))
    }
    setShowRuns(!showRuns)
  }

  async function onRunNow() {
    setBusy(true)
    setMessage('')
    try {
      const r = await runJobAction(job.job_key)
      setMessage(`${r.status}: ${r.output}`)
      setRuns(null)
      onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not run.')
    } finally {
      setBusy(false)
    }
  }

  async function onToggleEnabled(enabled: boolean) {
    setBusy(true)
    try {
      await setJobEnabledAction(job.job_key, enabled)
      onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold">{job.job_key}</h2>
          <p className="mt-0.5 text-sm text-zinc-500">{job.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
            <span>
              Frequency: <strong>{job.frequency}</strong>
            </span>
            <span>
              Last run:{' '}
              {job.last_run ? (
                <>
                  <StatusDot status={job.last_run.status} /> ·{' '}
                  {fmtTime(job.last_run.started_at)}
                </>
              ) : (
                'never'
              )}
            </span>
            <span>{job.run_count_30d} runs in 30d</span>
          </div>
          {job.last_run?.output && (
            <p className="mt-2 truncate text-xs text-zinc-400">
              {job.last_run.output}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Enabled</span>
            <button
              type="button"
              role="switch"
              aria-checked={job.enabled}
              aria-label={`Enable ${job.job_key}`}
              disabled={busy}
              onClick={() => onToggleEnabled(!job.enabled)}
              className={`relative h-6 w-11 rounded-full transition ${
                job.enabled ? 'bg-green-600' : 'bg-zinc-300'
              } disabled:opacity-50`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  job.enabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </label>
          <button
            type="button"
            onClick={onRunNow}
            disabled={busy}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {busy ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>

      {message && <p className="mt-3 text-sm text-zinc-600">{message}</p>}

      <button
        type="button"
        onClick={toggleRuns}
        className="mt-3 text-sm text-zinc-500 underline hover:text-zinc-700"
      >
        {showRuns ? 'Hide run history' : 'Show run history'}
      </button>
      {showRuns && (
        <div className="mt-2 overflow-x-auto">
          {runs === null ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-zinc-400">No runs recorded yet.</p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-zinc-400">
                  <th className="px-2 py-1">Started</th>
                  <th className="px-2 py-1">Finished</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">By</th>
                  <th className="px-2 py-1">Output</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-500">
                      {fmtTime(r.started_at)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-500">
                      {fmtTime(r.finished_at)}
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusDot status={r.status} />
                    </td>
                    <td className="px-2 py-1.5 text-zinc-600">{r.triggered_by}</td>
                    <td className="max-w-[280px] truncate px-2 py-1.5 text-xs text-zinc-500">
                      {r.status === 'failed' ? r.error : r.output}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}

export default function JobsList({ initial }: { initial: JobInfo[] }) {
  const [jobs, setJobs] = useState(initial)

  // Refresh is intentionally simple: the page re-fetches on navigation.
  // Run-now and enable toggles update via the actions above.
  return (
    <div className="space-y-4">
      {jobs.map((j) => (
        <JobCard
          key={j.job_key}
          job={j}
          onChanged={() => window.location.reload()}
        />
      ))}
    </div>
  )
}
