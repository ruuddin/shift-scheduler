import { GuideHeader, Steps } from '../components'

export const metadata = {
  title: 'Signing up & signing in — Shift Scheduler guides',
}

export default function AuthGuide() {
  return (
    <>
      <GuideHeader
        title="Signing up & signing in"
        blurb="Create your account, set up your team, and sign in on any device. One login works across all your teams."
      />
      <h2 className="mt-8 text-lg font-semibold">Create your account</h2>
      <Steps
        items={[
          <>
            Open the app and tap <strong>Create an account</strong> (or go to{' '}
            <strong>/signup</strong>).
          </>,
          <>
            Enter <strong>your name</strong>, a <strong>team name</strong> (e.g.
            your cafe or store), your <strong>email</strong>, and a{' '}
            <strong>password</strong> (6+ characters).
          </>,
          <>
            Tap <strong>Create team</strong> — you&apos;ll land on your{' '}
            <strong>dashboard</strong> as the team&apos;s manager. No email
            confirmation needed.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Sign in</h2>
      <Steps
        items={[
          <>
            Go to <strong>/login</strong>, enter your <strong>email</strong> and{' '}
            <strong>password</strong>, and tap <strong>Sign in</strong>.
          </>,
          <>
            You&apos;ll land on your dashboard with your <strong>active team</strong>{' '}
            selected. Use the <strong>team switcher</strong> at the top to move
            between teams.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Joining a team you were invited to</h2>
      <Steps
        items={[
          <>
            If a manager <strong>invited you</strong>, sign up with the{' '}
            <strong>same email address</strong> they invited — leave the team
            name as anything, it won&apos;t create a duplicate.
          </>,
          <>
            Your account <strong>links to the invite</strong> automatically, and
            their team appears in your team switcher.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Sign out</h2>
      <Steps
        items={[
          <>
            Tap <strong>Sign out</strong> on the dashboard. On a shared device,
            always sign out when you&apos;re done.
          </>,
        ]}
      />
    </>
  )
}
