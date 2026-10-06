import { GuideHeader, Steps, Note } from '@shift-scheduler/shared/guide-components'

export const metadata = {
  title: 'Shift swaps — Shift Scheduler guides',
}

export default function ShiftSwapsGuide() {
  return (
    <>
      <GuideHeader
        title="Shift swaps"
        blurb="Trade or give away shifts. Employees request, managers approve — nothing moves without approval."
      />

      <h2 className="mt-8 text-lg font-semibold">Request a swap (employees)</h2>
      <Steps
        items={[
          <>
            Open <strong>Shift swaps</strong> from your dashboard (or the{' '}
            <strong>Swap shifts</strong> button under My shifts).
          </>,
          <>
            Under <strong>Request a swap</strong>, pick one of your upcoming
            published shifts.
          </>,
          <>
            Choose a swap type: <strong>give to a coworker</strong>,{' '}
            <strong>trade shifts</strong> with a coworker (pick one of their
            shifts), or <strong>open offer</strong> and let your manager pick
            who covers.
          </>,
          <>
            Add a note if you like (e.g. “dentist appointment”), then{' '}
            <strong>Send request</strong>. Your manager reviews every request
            before anything changes.
          </>,
          <>
            Track it under <strong>My requests</strong> — you can{' '}
            <strong>cancel</strong> while it&apos;s still pending.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">
        Approve or decline (managers)
      </h2>
      <Steps
        items={[
          <>
            Open <strong>Shift swaps</strong> — pending requests show a count
            badge on your dashboard.
          </>,
          <>
            Each request shows the shift, who it&apos;s from, who it goes to
            (or that it&apos;s an open offer), and any trade shift.
          </>,
          <>
            For open offers, pick the <strong>assignee</strong> first, then{' '}
            <strong>Approve</strong> or <strong>Decline</strong>. Approving
            reassigns the shift immediately.
          </>,
          <>
            The app blocks double-booking: if the assignee already has an
            overlapping shift, approval is refused with an explanation.
          </>,
        ]}
      />
      <Note tone="tip">
        Swaps are behind the <strong>shift-swaps</strong> feature flag. Turn it
        off under Feature flags to hide the whole flow, or set the org to Off
        to disable it for every team at once. Every request, approval, decline,
        and cancellation is logged under Team activity.
      </Note>
    </>
  )
}
