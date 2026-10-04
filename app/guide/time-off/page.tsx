import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Time off & availability — Shift Scheduler guides',
}

export default function TimeOffGuide() {
  return (
    <>
      <GuideHeader
        title="Time off & availability"
        blurb="Request time off, set your weekly availability, and let managers approve it all in one place."
      />

      <h2 className="mt-8 text-lg font-semibold">Request time off (employees)</h2>
      <Steps
        items={[
          <>
            Open <strong>Time off</strong> from your dashboard.
          </>,
          <>
            Under <strong>Request time off</strong>, pick the{' '}
            <strong>from</strong> and <strong>to</strong> dates and add a reason
            if you like.
          </>,
          <>
            <strong>Send request</strong> — overlapping requests are rejected
            up front, so you can&apos;t double-book yourself.
          </>,
          <>
            Track it under <strong>My requests</strong>. You can{' '}
            <strong>cancel</strong> while it&apos;s still pending.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">
        Set your weekly availability (employees)
      </h2>
      <Steps
        items={[
          <>
            Under <strong>My weekly availability</strong>, uncheck{' '}
            <strong>Available</strong> on days you never work.
          </>,
          <>
            For part-day limits, set the <strong>unavailable window</strong>{' '}
            (e.g. 09:00–13:00) on an otherwise available day.
          </>,
          <>
            <strong>Save availability</strong>. Your manager sees the whole
            team&apos;s template on one screen.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">
        Approve or decline (managers)
      </h2>
      <Steps
        items={[
          <>
            Open <strong>Time off</strong> — pending requests show a count
            badge on your dashboard.
          </>,
          <>
            Review each request&apos;s dates and reason, then{' '}
            <strong>Approve</strong> or <strong>Decline</strong>.
          </>,
          <>
            Check <strong>Team availability</strong> before building the roster
            so you don&apos;t schedule someone who&apos;s off or unavailable.
          </>,
        ]}
      />
      <Note tone="tip">
        Time off is behind the <strong>time-off</strong> feature flag. Turn it
        off under Feature flags to hide the whole flow, or set the org to Off
        to disable it for every team at once. Every request, decision,
        cancellation, and availability change is logged under Team activity.
      </Note>
    </>
  )
}
