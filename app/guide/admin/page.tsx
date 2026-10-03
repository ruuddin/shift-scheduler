import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Admin & event history — Shift Scheduler guides',
}

export default function AdminGuide() {
  return (
    <>
      <GuideHeader
        title="Admin & event history"
        blurb="See everything that happened on your team — every sign-in, invite, and schedule change. Managers only."
      />
      <h2 className="mt-8 text-lg font-semibold">Open the admin page</h2>
      <Steps
        items={[
          <>
            From the <strong>dashboard</strong>, tap <strong>Admin</strong>. (Or
            open the roster and use the Guides link to get here first.)
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
            and a one-line <strong>summary</strong> — e.g. “Ben Barista •
            2026-10-05 • 7:00a–3:00p”.
          </>,
          <>
            The list is <strong>newest first</strong>, so the latest activity is
            always on top.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">What gets recorded</h2>
      <Steps
        items={[
          <>
            <strong>Auth:</strong> team sign-ups, sign-ins, and sign-outs.
          </>,
          <>
            <strong>Team:</strong> every employee invite, with the
            teammate&apos;s name and email.
          </>,
          <>
            <strong>Shifts:</strong> every create, edit, drag-and-drop move, and
            delete — including who the shift belonged to and its times.
          </>,
        ]}
      />
      <Note tone="warn">
        <p>
          In <strong>preview mode</strong> (before Supabase keys are connected)
          the history is kept in the server&apos;s memory and resets when the
          server restarts — so it&apos;s best for trying things out, not for
          permanent records. Once Supabase is connected, every event is stored
          in the <code>events</code> table permanently.
        </p>
      </Note>
      <Note tone="tip">
        <p>
          Tip: check the admin page after publishing a new week&apos;s schedule
          — it&apos;s the fastest way to confirm exactly what changed and when.
        </p>
      </Note>
    </>
  )
}
