import { GuideHeader, Steps, Note } from '../components'

export const metadata = { title: 'Dashboard — Shift Scheduler guides' }

export default function DashboardGuide() {
  return (
    <>
      <GuideHeader
        title="Dashboard"
        blurb="Your home base after signing in. What you see depends on your role."
      />
      <h2 className="mt-8 text-lg font-semibold">As a manager</h2>
      <Steps
        items={[
          <>
            After signing in you see your <strong>team name</strong> and your
            email with the <strong>manager</strong> label at the top.
          </>,
          <>
            Tap <strong>Open roster</strong> to build the weekly schedule.
          </>,
          <>
            Tap <strong>Invite employees</strong> to add teammates to your team.
          </>,
          <>
            Use the <strong>sign-out</strong> button (top right) when you&apos;re
            done on a shared device.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">As an employee</h2>
      <Steps
        items={[
          <>
            After signing in you see a <strong>My shifts</strong> card.
          </>,
          <>
            Once your manager builds and publishes a week, your shifts appear
            here automatically.
          </>,
        ]}
      />
      <Note tone="tip">
        <p>
          Managers: if you only see the dashboard and no roster link, you may
          be signed in with an employee account. Ask your team&apos;s manager to
          confirm your role.
        </p>
      </Note>
    </>
  )
}
