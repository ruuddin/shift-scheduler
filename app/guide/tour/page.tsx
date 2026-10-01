import { GuideHeader, Steps, Note } from '../components'

export const metadata = { title: 'Guided tour — Shift Scheduler guides' }

export default function TourGuide() {
  return (
    <>
      <GuideHeader
        title="Guided tour"
        blurb="A first-run walkthrough of the roster. Replay it anytime."
      />
      <Steps
        items={[
          <>
            The tour <strong>starts automatically</strong> the first time you
            open the roster — it points at the week navigation, the grid (or
            day view on phones), shifts, and how to add one.
          </>,
          <>
            Step through with <strong>Next</strong>, or close it anytime — it
            won&apos;t auto-start again on that browser.
          </>,
          <>
            To replay it later, tap the <strong>Take tour</strong> button at
            the top of the roster (next to the week navigation).
          </>,
        ]}
      />
      <Note>
        <p>
          The tour adapts to your device: on phones it highlights the day
          pills and teammate cards; on computers it highlights the full-week
          grid. Steps that don&apos;t apply (e.g. drag-and-drop while
          it&apos;s disabled) are skipped automatically.
        </p>
      </Note>
    </>
  )
}
