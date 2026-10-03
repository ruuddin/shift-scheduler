import Link from 'next/link'

const GUIDES = [
  {
    href: '/guide/getting-started',
    title: 'Getting started',
    blurb: 'Create your team, sign in, and understand preview mode.',
  },
  {
    href: '/guide/dashboard',
    title: 'Dashboard',
    blurb: 'What managers and employees each see after signing in.',
  },
  {
    href: '/guide/inviting-employees',
    title: 'Inviting employees',
    blurb: 'Add teammates so they can sign up and join your team.',
  },
  {
    href: '/guide/roster',
    title: 'Roster week view',
    blurb: 'Navigate weeks and read the schedule on desktop and mobile.',
  },
  {
    href: '/guide/shifts',
    title: 'Adding, editing & deleting shifts',
    blurb: 'Step-by-step for creating and changing shifts.',
  },
  {
    href: '/guide/drag-and-drop',
    title: 'Drag-and-drop scheduling',
    blurb: 'Move shifts between days and teammates on desktop.',
  },
  {
    href: '/guide/tour',
    title: 'Guided tour',
    blurb: 'Replay the first-run tour of the roster anytime.',
  },
  {
    href: '/guide/admin',
    title: 'Admin & event history',
    blurb: 'Browse every action on your team and read the analytics.',
  },
  {
    href: '/guide/teams',
    title: 'Working with multiple teams',
    blurb: 'Switch between your teams and create new ones.',
  },
  {
    href: '/guide/auth',
    title: 'Signing up & signing in',
    blurb: 'Create your account, join teams, and sign in on any device.',
  },
]

export default function GuideIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/roster" className="hover:underline">
          ← Back to roster
        </Link>
      </nav>
      <h1 className="text-2xl font-bold md:text-3xl">User guides</h1>
      <p className="mt-2 text-zinc-500">
        Step-by-step instructions for every feature in Shift Scheduler. Pick a
        topic below — each guide lives on its own page.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="rounded-xl border bg-white p-5 transition hover:border-zinc-400 hover:shadow-sm"
          >
            <h2 className="font-semibold">{g.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{g.blurb}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
