import { GuideHeader, Steps, Note } from '@shift-scheduler/shared/guide-components'

export const metadata = { title: 'Inviting employees — Shift Scheduler guides' }

export default function InvitingEmployeesGuide() {
  return (
    <>
      <GuideHeader
        title="Inviting employees"
        blurb="Add teammates so they can sign up and join your team. Managers only."
      />
      <Steps
        items={[
          <>
            From the dashboard, tap <strong>Invite employees</strong>.
          </>,
          <>
            Enter the teammate&apos;s <strong>name</strong> and{' '}
            <strong>email address</strong>.
          </>,
          <>
            Tap <strong>Add employee</strong>. You&apos;ll see a confirmation
            like “ada@cafe.com added — they can sign up now.”
          </>,
          <>
            Tell your teammate to <strong>sign up with that same email</strong>.
            Their new account links to your team automatically and they join as
            an <strong>employee</strong>.
          </>,
          <>
            Repeat for each teammate. They&apos;ll appear on the roster once
            added.
          </>,
        ]}
      />
      <Note>
        <p>
          Invited teammates must use the exact email you entered. If they sign
          up with a different address, they won&apos;t be linked to your team —
          just re-invite them with the correct email.
        </p>
      </Note>
      <Note tone="tip">
        <p>
          In preview mode (no database keys), the invite screen isn&apos;t
          available — the demo roster ships with sample teammates instead.
        </p>
      </Note>
    </>
  )
}
