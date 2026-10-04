import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminFlags, getFlagHistoryAction } from '@/app/flags-actions'
import { getAdminOrgFlagsAction } from '@/app/org-actions'
import AdminFlagsList, { ToggleHistory, OrgFlagsSection } from './flags-ui'

export const metadata = {
  title: 'Admin — feature flags — Shift Scheduler',
}

export default async function AdminFlagsPage() {
  let flagsData
  let orgFlags
  try {
    ;[flagsData, orgFlags] = await Promise.all([
      getAdminFlags(),
      getAdminOrgFlagsAction().catch(() => []),
    ])
  } catch {
    redirect('/dashboard')
  }
  const history = await getFlagHistoryAction().catch(() => [])

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          ← Back to admin
        </Link>
      </nav>
      <h1 className="text-2xl font-bold md:text-3xl">Feature flags</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Global defaults, organization ceilings, per-team overrides, and the
        full toggle history. The default applies to every team without its own
        override.
      </p>
      {flagsData.preview && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Preview mode — values are shown for demo and aren&apos;t saved.
        </p>
      )}

      <div className="mt-6">
        <AdminFlagsList initial={flagsData.flags} />
      </div>

      {orgFlags.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold">
            Organization ceilings
          </h2>
          <p className="mb-3 text-sm text-zinc-500">
            An org set to <strong>Off</strong> disables the feature for all its
            teams — no team can turn it back on.
          </p>
          <OrgFlagsSection initial={orgFlags} />
        </>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">Toggle history</h2>
      <p className="mb-3 text-sm text-zinc-500">
        Who changed what, and when — newest first.
      </p>
      <ToggleHistory history={history} />
    </main>
  )
}
