import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Feedback — Shift Scheduler guides',
}

export default function FeedbackGuide() {
  return (
    <>
      <GuideHeader
        title="Feedback"
        blurb="Tell us what's broken, what you wish existed, or anything else. Your manager and our team can see it."
      />

      <h2 className="mt-8 text-lg font-semibold">Send feedback</h2>
      <Steps
        items={[
          <>
            Open <strong>Feedback</strong> from your dashboard.
          </>,
          <>
            Pick what it&apos;s about: <strong>Bug report</strong>,{' '}
            <strong>Feature request</strong>, or <strong>General note</strong>.
          </>,
          <>
            Write your feedback (up to 5000 characters) and optionally rate
            us 1–5 stars.
          </>,
          <>
            Press <strong>Send feedback</strong>. Your past submissions appear
            below the form with their status: <strong>new</strong>,{' '}
            <strong>reviewed</strong>, or <strong>resolved</strong>.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">Who sees it</h2>
      <Steps
        items={[
          <>
            Your org&apos;s <strong>managers</strong> can see feedback from
            their own organization.
          </>,
          <>
            Our team reviews everything across all clients in the admin
            portal and marks items reviewed or resolved as we work through
            them.
          </>,
        ]}
      />

      <Note>
        Feedback is honest signal — the more specific you are (what page, what
        you expected, what happened instead), the faster it gets fixed.
      </Note>
    </>
  )
}
