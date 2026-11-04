import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Shift Scheduler — simple shift scheduling for hourly teams',
  description:
    'Drag-and-drop shift scheduling for hourly teams: build the week, publish it, and handle swaps and time-off requests in one place. Free during pilot.',
}

const FEATURES = [
  {
    title: 'Drag-and-drop scheduling',
    blurb:
      'Build the week by dragging shifts between days and teammates, then publish it to the whole team.',
  },
  {
    title: 'Everyone sees their own shifts',
    blurb:
      'Employees open the app and see exactly when they work — no screenshots of a spreadsheet, no group-chat digging.',
  },
  {
    title: 'Swaps with manager approval',
    blurb:
      'Staff request a swap in-app and a manager approves it in one click. No double-bookings, no lost texts.',
  },
  {
    title: 'Time-off and availability',
    blurb:
      'Time-off requests and weekly availability live next to the schedule, so gaps show up before publishing.',
  },
  {
    title: 'Organizations and roles',
    blurb:
      'Run several teams under one organization, with roles and reporting lines that match how you actually manage.',
  },
  {
    title: 'Announcements',
    blurb:
      'Post a notice to a team and know it reached everyone on the roster.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Create your team',
    blurb: 'Sign up, name your team, and invite your people.',
  },
  {
    n: '2',
    title: 'Build the week',
    blurb: 'Drag shifts onto the calendar and publish when it looks right.',
  },
  {
    n: '3',
    title: 'Let the app handle the rest',
    blurb: 'Swaps, time-off, and announcements flow through the app — not your inbox.',
  },
]

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 text-zinc-900">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between py-5">
        <span className="text-lg font-bold">Shift Scheduler</span>
        <Link href="/login" className="text-sm font-medium underline">
          Sign in
        </Link>
      </header>

      <section className="mx-auto w-full max-w-3xl py-10 text-center sm:py-16">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Scheduling your team shouldn&apos;t need a spreadsheet.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-zinc-600 sm:text-lg">
          Shift Scheduler is a simple web app for hourly teams: build the
          week, publish it, and handle swaps and time-off in one place.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-md bg-zinc-900 px-6 py-3 text-center font-medium text-white sm:w-auto"
          >
            Start free
          </Link>
          <Link
            href="/guide/getting-started"
            className="w-full rounded-md border border-zinc-300 bg-white px-6 py-3 text-center font-medium sm:w-auto"
          >
            See how it works
          </Link>
        </div>
        <p className="mt-4 text-sm text-zinc-500">
          Free during pilot. No credit card required.
        </p>
      </section>

      <section className="mx-auto w-full max-w-3xl py-8">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4 rounded-xl bg-white p-5 shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
                {s.n}
              </span>
              <span>
                <span className="block font-semibold">{s.title}</span>
                <span className="mt-1 block text-sm text-zinc-600">{s.blurb}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-3xl py-8">
        <h2 className="text-2xl font-bold">What&apos;s inside</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-xl bg-white p-5 shadow-sm">
              <span className="block font-semibold">{f.title}</span>
              <span className="mt-1 block text-sm text-zinc-600">{f.blurb}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-3xl py-8 text-center">
        <h2 className="text-2xl font-bold">Try it with your next week&apos;s schedule</h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600">
          Set up a team in minutes, invite your staff, and publish a real
          week. If it doesn&apos;t beat your spreadsheet, you&apos;ve lost nothing.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-block w-full rounded-md bg-zinc-900 px-6 py-3 font-medium text-white sm:w-auto"
        >
          Start free
        </Link>
      </section>

      <footer className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-3 border-t border-zinc-200 py-6 text-sm text-zinc-500 sm:flex-row">
        <span>© 2026 Shift Scheduler</span>
        <span className="flex gap-4">
          <Link href="/guide" className="underline">
            Guides
          </Link>
          <Link href="/login" className="underline">
            Sign in
          </Link>
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </span>
      </footer>
    </main>
  )
}
