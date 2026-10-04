import { GuideHeader, Steps, Note } from '../components'

export const metadata = {
  title: 'Feature flags — Shift Scheduler guides',
}

export default function FlagsGuide() {
  return (
    <>
      <GuideHeader
        title="Feature flags"
        blurb="Turn features on or off for your team — safely roll out changes, and see exactly who changed what. Managers only."
      />
      <h2 className="mt-8 text-lg font-semibold">Toggle features for your team</h2>
      <Steps
        items={[
          <>
            From the <strong>dashboard</strong>, tap <strong>Feature flags</strong>.
            (Or go to <strong>/settings/feature-flags</strong>.)
          </>,
          <>
            Each feature shows a <strong>description</strong> and how many teams
            and users it&apos;s currently enabled for.
          </>,
          <>
            Flip the switch for your <strong>active team</strong> — the change
            applies to that team only. Switch teams first if you manage more
            than one.
          </>,
        ]}
      />
      <Note tone="tip">
        Flag changes take effect within seconds. If a feature misbehaves, turn
        its flag off here first — it&apos;s the fastest kill switch you have.
      </Note>

      <h2 className="mt-8 text-lg font-semibold">Admin view: defaults & history</h2>
      <Steps
        items={[
          <>
            Open <strong>Admin → Feature flags</strong> (or go to{' '}
            <strong>/admin/flags</strong>).
          </>,
          <>
            The <strong>Default</strong> switch sets the flag for every team
            that hasn&apos;t chosen its own override.
          </>,
          <>
            Below each flag you&apos;ll see <strong>team overrides</strong> —
            which teams differ from the default.
          </>,
          <>
            The <strong>toggle history</strong> table at the bottom shows every
            change: when it happened, which flag, the old and new value, and{' '}
            <strong>who made it</strong>.
          </>,
        ]}
      />
      <Note>
        Flag evaluations are cached for 24 hours to keep pages fast. Toggling a
        flag clears the cache immediately, so you never wait a day for your own
        change.
      </Note>
    </>
  )
}
