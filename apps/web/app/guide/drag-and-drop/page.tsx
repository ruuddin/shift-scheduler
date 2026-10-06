import { GuideHeader, Steps, Note } from '@shift-scheduler/shared/guide-components'

export const metadata = { title: 'Drag-and-drop scheduling — Shift Scheduler guides' }

export default function DragAndDropGuide() {
  return (
    <>
      <GuideHeader
        title="Drag-and-drop scheduling"
        blurb="Move shifts between days and teammates without retyping times. Desktop only."
      />
      <Steps
        items={[
          <>
            Open the roster on a <strong>computer</strong> — drag-and-drop is
            available in the full-week grid view.
          </>,
          <>
            <strong>Press and hold</strong> a shift block until it lifts, then{' '}
            <strong>drag</strong> it to another day column, another
            teammate&apos;s row, or both.
          </>,
          <>
            <strong>Drop</strong> it on the target cell. The shift keeps its
            start and end times — only the day and/or teammate changes.
          </>,
          <>
            The roster updates immediately. If saving fails, the shift snaps
            back and you&apos;ll see an error message.
          </>,
        ]}
      />
      <Note>
        <p>
          On a phone, drag-and-drop isn&apos;t available — tap the shift to
          edit it instead, or delete it and add a new one on the right day.
        </p>
      </Note>
      <Note tone="tip">
        <p>
          Quick reshuffle: drag a shift along its <strong>row</strong> to move
          it to a different day for the same person, or down a{' '}
          <strong>column</strong> to hand the same day&apos;s shift to a
          teammate.
        </p>
      </Note>
    </>
  )
}
