import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Admin portal — Shift Scheduler guides',
}

export default function AdminGuide() {
  return (
    <>
      <GuideHeader
        title="Admin portal"
        blurb="The owner's console for managing clients. Not for customer managers — their tools live under dashboard settings."
      />
      <h2 className="mt-8 text-lg font-semibold">Who can open it</h2>
      <Steps
        items={[
          <>
            Only the <strong>owner</strong> — sign-ins whose email is in the{' '}
            <strong>OWNER_EMAILS</strong> allowlist. Everyone else is sent back
            to their dashboard.
          </>,
          <>
            Set <strong>OWNER_EMAILS</strong> (comma-separated) in the
            environment. Until it&apos;s set, nobody passes the gate.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Manage clients</h2>
      <Steps
        items={[
          <>
            The portal opens on the <strong>client list</strong>: every
            organization, with team count, member count, and join date.
          </>,
          <>
            Tap <strong>Manage →</strong> on a client to open its detail page:{' '}
            <strong>teams</strong> and their member counts, <strong>roles</strong>{' '}
            with how many members hold each, <strong>feature flags</strong>{' '}
            (org-level ceilings you can toggle for that client), and{' '}
            <strong>recent activity</strong> across the client&apos;s teams.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Owner tools</h2>
      <Steps
        items={[
          <>
            <strong>Feature flags</strong> — global defaults for every client,
            per-team overrides, and the full toggle history with who/when.
          </>,
          <>
            <strong>Jobs</strong> — background job status, frequencies, run
            history, and on-demand runs.
          </>,
          <>
            <strong>Troubleshooting</strong> — the ops runbook: detect, triage,
            diagnose, mitigate, fix, learn.
          </>,
        ]}
      />
      <Note tone="warn">
        Client managers manage their own org from <strong>/settings/organization</strong>{' '}
        (roles, members, org flags) and <strong>/settings/feature-flags</strong>{' '}
        (team flags). They never need the admin portal — and can&apos;t open it.
      </Note>
    </>
  )
}
