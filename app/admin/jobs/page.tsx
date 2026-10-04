import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getJobsAction } from '@/app/admin/jobs-actions'
import JobsList from './jobs-ui'

export const metadata = {
  title: 'Admin — background jobs — Shift Scheduler',
}

export default async function AdminJobsPage() {
  let data
  try {
    data = await getJobsAction()
  } catch {
    redirect('/dashboard')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          ← Back to admin
        </Link>
      </nav>
      <h1 className="text-2xl font-bold md:text-3xl">Background jobs</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Recurring work the app runs on its own — status, frequencies, run
        history, and on-demand runs.
      </p>
      {data.preview && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Preview mode — no database, so there&apos;s nothing to run.
        </p>
      )}
      <div className="mt-6">
        <JobsList initial={data.jobs} />
      </div>
    </main>
  )
}
