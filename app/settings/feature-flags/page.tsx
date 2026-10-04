import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getManagerFlags } from '@/app/flags-actions'
import ManagerFlagsList from './flags-list'

export const metadata = {
  title: 'Feature flags — Shift Scheduler',
}

export default async function FeatureFlagsPage() {
  let data
  try {
    data = await getManagerFlags()
  } catch {
    redirect('/dashboard')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:underline">
          ← Back to dashboard
        </Link>
      </nav>
      <h1 className="text-2xl font-bold md:text-3xl">Feature flags</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Turn features on or off for <strong>{data.teamName}</strong>. Changes
        apply to your active team only and take effect within a few seconds.
      </p>
      {data.preview && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Preview mode — toggles are shown for demo and aren&apos;t saved.
        </p>
      )}
      <div className="mt-6">
        <ManagerFlagsList initial={data.flags} teams={data.teams} />
      </div>
      <p className="mt-6 text-xs text-zinc-400">
        Every change is recorded — who toggled what and when is visible in the{' '}
        <Link href="/admin/flags" className="underline">
          admin flags view
        </Link>
        .
      </p>
    </main>
  )
}
