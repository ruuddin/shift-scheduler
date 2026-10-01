import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Adding, editing & deleting shifts — Shift Scheduler guides',
}

export default function ShiftsGuide() {
  return (
    <>
      <GuideHeader
        title="Adding, editing & deleting shifts"
        blurb="Create shifts and change them later. Managers only."
      />
      <h2 className="mt-8 text-lg font-semibold">Add a shift</h2>
      <Steps
        items={[
          <>
            <strong>On a computer:</strong> click any <strong>empty cell</strong>{' '}
            in the grid — the crossing of a teammate&apos;s row and a day
            column.
          </>,
          <>
            <strong>On a phone:</strong> pick the day with the day pills, then
            tap <strong>+ Add</strong> on the teammate&apos;s card.
          </>,
          <>
            In the dialog, set the <strong>Start</strong> and{' '}
            <strong>End</strong> times (defaults 9:00 AM – 5:00 PM).
          </>,
          <>
            Tap <strong>Save</strong>. The shift appears immediately on the
            roster.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Edit a shift</h2>
      <Steps
        items={[
          <>
            <strong>Tap (phone)</strong> or <strong>click (computer)</strong> the
            shift block you want to change.
          </>,
          <>
            Adjust the <strong>Start</strong> and <strong>End</strong> times in
            the dialog.
          </>,
          <>
            Tap <strong>Save</strong> to apply the change.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Delete a shift</h2>
      <Steps
        items={[
          <>
            <strong>Tap (phone)</strong> or <strong>click (computer)</strong> the
            shift block.
          </>,
          <>
            In the dialog, tap <strong>Delete</strong> and confirm.
          </>,
          <>
            The shift is removed from the roster immediately.
          </>,
        ]}
      />
      <Note tone="warn">
        <p>
          The end time must be after the start time — the app will tell you if
          it isn&apos;t. Shifts that end after midnight aren&apos;t supported;
          split them into two shifts instead.
        </p>
      </Note>
    </>
  )
}
