import { GuideHeader, Steps, Note } from '@shift-scheduler/shared/guide-components'

export const metadata = {
  title: 'Announcements — Shift Scheduler guides',
}

export default function AnnouncementsGuide() {
  return (
    <>
      <GuideHeader
        title="Announcements"
        blurb="One-to-many updates from managers — org-wide or to specific teams. The app's broadcast channel; there is no DM or team chat."
      />

      <h2 className="mt-8 text-lg font-semibold">Reading announcements</h2>
      <Steps
        items={[
          <>
            Open your <strong>dashboard</strong> — announcements appear at the
            top, newest first.
          </>,
          <>
            Each one shows whether it covers your <strong>entire
            organization</strong> or just <strong>your team</strong>, who posted
            it, and when.
          </>,
        ]}
      />

      <h2 className="mt-8 text-lg font-semibold">Posting (managers only)</h2>
      <Steps
        items={[
          <>
            In the <strong>Announcements</strong> section of your dashboard,
            fill in a <strong>title</strong> and the <strong>message</strong>.
          </>,
          <>
            Choose the audience: <strong>Entire organization</strong> reaches
            every team, or pick <strong>Specific teams</strong> to reach only
            the teams you tick.
          </>,
          <>
            Press <strong>Post announcement</strong>. It appears instantly on
            every recipient&apos;s dashboard.
          </>,
          <>
            To remove one, press <strong>Delete</strong> on the announcement.
          </>,
        ]}
      />
      <Note>
        Only members whose organization role grants manager permissions can
        post or delete. Employees can read but never post.
      </Note>
      <Note tone="tip">
        Use org-wide posts for policy changes and holidays; use team posts for
        shift-specific notes like &quot;Friday close needs two extra
        hands.&quot;
      </Note>
    </>
  )
}
