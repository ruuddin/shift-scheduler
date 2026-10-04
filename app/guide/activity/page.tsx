import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Team activity — Shift Scheduler guides',
}

export default function ActivityGuide() {
  return (
    <>
      <GuideHeader
        title="Team activity"
        blurb="See everything that happened on your team — every sign-in, invite, and schedule change. Managers only."
      />
      <h2 className="mt-8 text-lg font-semibold">Open team activity</h2>
      <Steps
        items={[
          <>
            From the <strong>dashboard</strong>, tap{' '}
            <strong>Team activity</strong>.
          </>,
          <>
            Only <strong>managers</strong> can open it — employees are sent back
            to their dashboard.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Read the analytics summary</h2>
      <Steps
        items={[
          <>
            At the top you&apos;ll see <strong>four numbers</strong>: total
            events, events today, how many people did things, and how many
            kinds of events happened.
          </>,
          <>
            Below that, the <strong>activity breakdown</strong> shows a pill per
            event kind with its count — for example “Shift created · 12”.
          </>,
          <>
            <strong>Tap a pill</strong> to filter the history to just that kind
            of event. Tap it again to clear.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Search the full history</h2>
      <Steps
        items={[
          <>
            Use the <strong>filter bar</strong>: pick an event type from the
            dropdown, type in the <strong>search box</strong> (matches email
            addresses, shift IDs, and details), or set a <strong>from/to
            date</strong> range.
          </>,
          <>
            Tap <strong>Filter</strong> to apply, or <strong>Clear</strong> to
            start over.
          </>,
          <>
            Every row shows <strong>when</strong> it happened, <strong>who</strong>{' '}
            did it (and their role), <strong>what</strong> kind of event it was,
            and a one-line <strong>summary</strong>.
          </>,
          <>
            The list is <strong>newest first</strong>, so the latest activity is
            always on top.
          </>,
        ]}
      />
      <Note tone="warn">
        In <strong>preview mode</strong> the history is kept in the
        server&apos;s memory and resets when the server restarts. Once Supabase
        is connected, every event is stored in the <code>events</code> table
        permanently.
      </Note>
      <Note tone="tip">
        Tip: check team activity after publishing a new week&apos;s schedule —
        it&apos;s the fastest way to confirm exactly what changed and when.
      </Note>
    </>
  )
}
