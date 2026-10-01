import { GuideHeader, Steps, Note } from '../components'

export const metadata = { title: 'Getting started — Shift Scheduler guides' }

export default function GettingStartedGuide() {
  return (
    <>
      <GuideHeader
        title="Getting started"
        blurb="Create your team, sign in, and understand how preview mode works."
      />
      <h2 className="mt-8 text-lg font-semibold">Create your team (managers)</h2>
      <Steps
        items={[
          <>
            Open the app and choose <strong>Create an account</strong> on the
            sign-in screen.
          </>,
          <>
            Enter <strong>your name</strong>, a <strong>team name</strong> (e.g.
            “Blue Bottle — Hayes Valley”), your <strong>email</strong>, and a{' '}
            <strong>password</strong> (at least 6 characters).
          </>,
          <>
            Tap <strong>Create team</strong>. You become the{' '}
            <strong>manager</strong> — managers build the roster and invite the
            team.
          </>,
          <>
            You land on your <strong>dashboard</strong>. From there, open the
            roster or invite employees.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Sign in (everyone)</h2>
      <Steps
        items={[
          <>
            Open the app and enter the <strong>email</strong> and{' '}
            <strong>password</strong> you signed up with.
          </>,
          <>
            Tap <strong>Sign in</strong>. Managers land on the dashboard;
            employees see their published shifts.
          </>,
          <>
            If you were invited as an employee, sign up with the{' '}
            <strong>same email</strong> your manager used to invite you — your
            account links to your team automatically.
          </>,
        ]}
      />
      <Note>
        <p>
          <strong>Preview mode:</strong> if the app is running without its
          database keys, you&apos;ll see an amber banner saying schedule edits
          are kept in the session only. Everything works — shifts, drag-and-drop,
          the tour — but changes disappear when you reload. Connect Supabase
          keys to persist real data.
        </p>
      </Note>
    </>
  )
}
