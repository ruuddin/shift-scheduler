import { GuideHeader, Steps, Note } from '@shift-scheduler/shared/guide-components'

export const metadata = {
  title: 'Background jobs — Shift Scheduler guides',
}

export default function JobsGuide() {
  return (
    <>
      <GuideHeader
        title="Background jobs"
        blurb="Recurring work the app does on its own — like the nightly analytics rollup. Watch status, history, and run jobs on demand. Managers only."
      />
      <h2 className="mt-8 text-lg font-semibold">View jobs</h2>
      <Steps
        items={[
          <>
            Open <strong>Admin → Jobs</strong> (or go to <strong>/admin/jobs</strong>).
          </>,
          <>
            Each job shows its <strong>description</strong>, how often it runs
            (<strong>frequency</strong>), the <strong>status</strong> of its last
            run, and how many times it ran in the last 30 days.
          </>,
          <>
            Tap <strong>Show run history</strong> on any job to see every
            execution: when it started and finished, whether it succeeded, who
            triggered it, and what it reported.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">Run a job now</h2>
      <Steps
        items={[
          <>
            Tap <strong>Run now</strong> on the job card. The run is recorded
            in history with your email as the trigger.
          </>,
          <>
            Use this after a failed nightly run, or when you want fresh
            analytics without waiting for tonight.
          </>,
        ]}
      />
      <Note tone="tip">
        The <strong>analytics-daily-rollup</strong> job runs every night and
        keeps the last 90 days of per-team active-user counts fresh. That data
        powers the analytics summary on the Admin page.
      </Note>

      <h2 className="mt-8 text-lg font-semibold">Pause a job</h2>
      <Steps
        items={[
          <>
            Flip the <strong>Enabled</strong> switch off to pause a job&apos;s
            schedule. Scheduled runs skip disabled jobs; you can still trigger
            them manually with <strong>Run now</strong>.
          </>,
        ]}
      />
      <Note tone="warn">
        Pausing the analytics rollup stops the 90-day active-user data from
        updating. The admin analytics will go stale until you re-enable it.
      </Note>
    </>
  )
}
