import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Working with multiple teams — Shift Scheduler guides',
}

export default function TeamsGuide() {
  return (
    <>
      <GuideHeader
        title="Working with multiple teams"
        blurb="Belong to more than one team — switch between them, and create new ones. Each team keeps its own roster, invites, and history."
      />
      <h2 className="mt-8 text-lg font-semibold">See your teams</h2>
      <Steps
        items={[
          <>
            On the <strong>dashboard</strong>, look at the top next to your team
            name — you&apos;ll see a <strong>team switcher</strong> button
            showing your current team.
          </>,
          <>
            Tap it to see <strong>every team you belong to</strong>, each with
            your role on that team (manager or employee).
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Switch teams</h2>
      <Steps
        items={[
          <>
            Open the team switcher and <strong>tap another team</strong>. The
            dashboard refreshes to show that team&apos;s name and your role
            there.
          </>,
          <>
            Everything follows the switch: the <strong>roster</strong>,{' '}
            <strong>invites</strong>, and <strong>admin history</strong> all
            show the active team&apos;s data.
          </>,
        ]}
      />
      <Note>
        Your role is per-team. You can be a manager on one team and an
        employee on another — each team only shows you what your role
        there allows.
      </Note>
      <h2 className="mt-8 text-lg font-semibold">Create a new team</h2>
      <Steps
        items={[
          <>
            Open the team switcher and tap <strong>+ New team…</strong>
          </>,
          <>
            Type the <strong>team name</strong> and tap <strong>Create</strong>.
            You become that team&apos;s manager and it becomes your active
            team.
          </>,
          <>
            From there, <strong>invite employees</strong> as usual — they&apos;ll
            join this new team when they sign up.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Joining another team</h2>
      <Steps
        items={[
          <>
            Ask that team&apos;s manager to <strong>invite you</strong> with the
            same email address you already use.
          </>,
          <>
            <strong>Sign up</strong> (or sign in) with that email — your account
            links to the invite and the new team appears in your switcher.
            One login, all your teams.
          </>,
        ]}
      />
    </>
  )
}
