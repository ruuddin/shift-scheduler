import { GuideHeader, Steps } from '../components'

export const metadata = {
  title: 'Team branding — Shift Scheduler guides',
}

export default function BrandingGuide() {
  return (
    <>
      <GuideHeader
        title="Team branding"
        blurb="Make the app feel like yours — add your logo and pick your team's color. Managers only."
      />
      <h2 className="mt-8 text-lg font-semibold">Open branding settings</h2>
      <Steps
        items={[
          <>
            From the <strong>dashboard</strong>, tap <strong>Team branding</strong>.
            (Or go to <strong>/settings/branding</strong>.)
          </>,
          <>
            Only <strong>managers</strong> can open it — and it applies to your{' '}
            <strong>active team</strong> (switch teams first if needed).
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Add your logo</h2>
      <Steps
        items={[
          <>
            Paste a <strong>direct link</strong> to your logo image (it must
            start with <code>https://</code>). Square images look best.
          </>,
          <>
            You&apos;ll see a <strong>preview</strong> right away. Tap{' '}
            <strong>Save branding</strong> when it looks right.
          </>,
          <>
            Your logo appears next to your <strong>team name</strong> on the
            dashboard.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Pick your color</h2>
      <Steps
        items={[
          <>
            Tap the <strong>color box</strong> and pick your team&apos;s color —
            or type a hex code like <code>#b91c1c</code>.
          </>,
          <>
            Your team name on the dashboard takes on <strong>your color</strong>,
            so each team feels distinct at a glance.
          </>,
        ]}
      />
      <h2 className="mt-8 text-lg font-semibold">Per-team branding</h2>
      <Steps
        items={[
          <>
            Branding is <strong>per team</strong>. Switch to another team and
            its own logo and color show up.
          </>,
        ]}
      />
    </>
  )
}
