import { GuideHeader, Steps, Note } from '../components'

export const metadata = { title: 'Roster week view — Shift Scheduler guides' }

export default function RosterGuide() {
  return (
    <>
      <GuideHeader
        title="Roster week view"
        blurb="Read the weekly schedule and move between weeks, on any device."
      />
      <h2 className="mt-8 text-lg font-semibold">Move between weeks</h2>
      <Steps
        items={[
          <>
            At the top of the roster you&apos;ll see the current week&apos;s
            date range (e.g. “Mon, Oct 5 – Sun, Oct 11”).
          </>,
          <>
            Tap <strong>← Prev</strong> to go back one week, or{' '}
            <strong>Next →</strong> to go forward one week.
          </>,
          <>
            Tap <strong>This week</strong> to snap back to the current week from
            anywhere.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">On a computer (desktop grid)</h2>
      <Steps
        items={[
          <>
            The roster shows a full-week grid: each <strong>row</strong> is a
            teammate, each <strong>column</strong> is a day (Mon–Sun).
          </>,
          <>
            Colored blocks are <strong>shifts</strong> — each shows its start
            and end time (e.g. “9a–6p”).
          </>,
          <>
            If the week is wider than your screen, scroll the grid sideways;
            the page itself never scrolls horizontally.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">On a phone (day view)</h2>
      <Steps
        items={[
          <>
            At the top you&apos;ll see a row of <strong>day pills</strong> (Mon
            → Sun). Swipe it sideways to reach every day.
          </>,
          <>
            Tap a day pill to select it — it turns dark. Below, every teammate
            gets a <strong>card</strong> showing only their shifts for that
            day.
          </>,
          <>
            The view starts on <strong>today</strong> when today is in the
            displayed week, otherwise on <strong>Monday</strong>.
          </>,
        ]}
      />
      <Note tone="tip">
        <p>
          New here? Tap <strong>Take tour</strong> at the top of the roster for
          a guided walkthrough of the week navigation, the grid, and shifts.
        </p>
      </Note>
    </>
  )
}
