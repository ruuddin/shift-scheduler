import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/owner'
import { getClientsAction } from './actions'

export const metadata = {
  title: 'Admin — clients — Shift Scheduler',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Owner-only: the SaaS owner's console for managing clients.
// Client managers do not come here — their tools live under /settings.
export default async function AdminPage() {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!preview) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    try {
      await requireOwner()
    } catch {
      redirect('/dashboard')
    }
  }

  const { clients } = await getClientsAction().catch(() => ({
    clients: [],
    preview: true,
  }))

  return (
    <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-6 md:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-zinc-500">
            Your clients — every organization on the platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/admin/flags"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Feature flags
          </Link>
          <Link
            href="/admin/jobs"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Jobs
          </Link>
          <Link
            href="/admin/feedback"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Feedback
          </Link>
          <Link
            href="/admin/troubleshooting"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Troubleshooting
          </Link>
        </div>
      </div>

      {preview && (
        <p className="mb-4 break-words rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Preview mode — demo data shown. Connect Supabase keys for live data.
        </p>
      )}

      {/* Admin guides — kept on the admin portal */}
      <div className="mb-6 rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Admin guides</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/troubleshooting"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Troubleshooting runbook
          </Link>
          <Link
            href="/guide/flags"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Feature flags guide
          </Link>
          <Link
            href="/guide/jobs"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Background jobs guide
          </Link>
          <Link
            href="/guide/admin"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Event history guide
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-zinc-400">
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Teams</th>
              <th className="px-4 py-2">Members</th>
              <th className="px-4 py-2">Since</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2">{c.team_count}</td>
                <td className="px-4 py-2">{c.member_count}</td>
                <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                  {fmtDate(c.created_at)}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/clients/${c.id}`}
                    className="text-sm text-zinc-600 underline hover:text-zinc-900"
                  >
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
