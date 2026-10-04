import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Organizations — Shift Scheduler guides',
}

export default function OrganizationsGuide() {
  return (
    <>
      <GuideHeader
        title="Organizations"
        blurb="Groups of teams with their own roles, reporting lines, and org-wide feature flags. Managers only."
      />

      <h2 className="mt-8 text-lg font-semibold">What an organization is</h2>
      <Steps
        items={[
          <>
            Every team belongs to exactly one <strong>organization</strong>.
            When you create a team, its organization is created automatically
            and you become its <strong>Owner</strong>.
          </>,
          <>
            You can belong to many organizations — switch teams to work in a
            different one. Open <strong>Organization</strong> from the dashboard
            to manage the active team&apos;s org.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">Define your own roles</h2>
      <Steps
        items={[
          <>
            In <strong>Organization → Roles</strong>, create the roles your org
            actually uses — e.g. Shift Lead, Crew, Trainee.
          </>,
          <>
            Give each role a <strong>rank</strong> (higher = more senior) and
            decide whether it grants <strong>manager permissions</strong>.
          </>,
          <>
            The hierarchy is enforced by the database: a manager&apos;s rank
            must be <strong>strictly higher</strong> than their reports&apos;.
            Same rank can&apos;t manage same rank, and lower can&apos;t manage
            higher.
          </>,
        ]}
      />
      <Note>
        The built-in roles are Owner (rank 100), Manager (50), and Employee
        (10). You can add your own anywhere in between — just keep ranks
        unique per role.
      </Note>

      <h2 className="mt-8 text-lg font-semibold">Set reporting lines</h2>
      <Steps
        items={[
          <>
            In <strong>Organization → Members</strong>, pick each
            member&apos;s <strong>role</strong> from your org&apos;s roles.
          </>,
          <>
            Pick their <strong>manager</strong> — everyone has at most one.
            The dropdown only offers members with a higher rank.
          </>,
          <>
            If a change would break the hierarchy (a cycle, or a demotion
            that inverts a reporting line), it&apos;s rejected with an
            explanation.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">Org-wide feature flags</h2>
      <Steps
        items={[
          <>
            In <strong>Organization → Organization feature flags</strong>, set
            each feature to <strong>On</strong>, <strong>Off</strong>, or{' '}
            <strong>Default</strong> (follow the global setting).
          </>,
          <>
            The org is a <strong>ceiling</strong>: Off here disables the
            feature for every team, and no team can turn it back on. Managers
            choosing per-team flags only see what the org allows.
          </>,
        ]}
      />
      <Note tone="tip">
        Rolling out a feature gradually? Leave the org on Default, then enable
        it team by team from <strong>Feature flags</strong> — or use{' '}
        <strong>Apply to multiple teams</strong> to flip several at once.
      </Note>
    </>
  )
}
