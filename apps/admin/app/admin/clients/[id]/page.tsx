import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireOwner } from '@shift-scheduler/shared/owner'
import { eventLabel, describeEvent } from '@shift-scheduler/shared/events'
import { getClientDetailAction } from '@/app/admin/actions'
import { ClientOrgFlags } from './client-ui'

export const metadata = {
  title: 'Admin — client detail — Shift Scheduler',
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Owner-only.
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  try {
    await requireOwner()
  } catch {
    redirect('/dashboard')
  }

  let detail
  try {
    ;({ detail } = await getClientDetailAction(id))
  } catch {
    redirect('/admin')
  }

  return (
    <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-6 md:py-8">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          ← Back to clients
        </Link>
      </nav>
      <h1 className="text-2xl font-bold">{detail.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Client since {fmtDate(detail.created_at)} · {detail.teams.length}{' '}
        team(s) · {detail.member_count} member(s)
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Teams</h2>
          <div className="space-y-2">
            {detail.teams.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border-t pt-2 text-sm first:border-0 first:pt-0"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-zinc-500">
                  {t.member_count} member{t.member_count === 1 ? '' : 's'}
                </span>
              </div>
            ))}
            {detail.teams.length === 0 && (
              <p className="text-sm text-zinc-500">No teams yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Roles</h2>
          <div className="space-y-2">
            {detail.roles.map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between border-t pt-2 text-sm first:border-0 first:pt-0"
              >
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-xs text-zinc-400">
                    rank {r.rank}
                    {r.is_manager ? ' · manager' : ''}
                  </span>
                </span>
                <span className="text-zinc-500">
                  {r.member_count} member{r.member_count === 1 ? '' : 's'}
                </span>
              </div>
            ))}
            {detail.roles.length === 0 && (
              <p className="text-sm text-zinc-500">No roles defined.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="mb-1 font-semibold">Feature flags for this client</h2>
        <p className="mb-3 text-sm text-zinc-500">
          Org-level ceilings. Off here disables the feature for all of the
          client&apos;s teams.
        </p>
        <ClientOrgFlags orgId={detail.id} initial={detail.flags} />
      </section>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Recent activity</h2>
        {detail.recent_events.length === 0 ? (
          <p className="text-sm text-zinc-500">No recent activity.</p>
        ) : (
          <div className="space-y-2">
            {detail.recent_events.map((e) => (
              <div
                key={e.id}
                className="flex items-start justify-between gap-3 border-t pt-2 text-sm first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{eventLabel(e.event_type)}</p>
                  <p className="truncate text-xs text-zinc-400">
                    {describeEvent(e)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">
                  {fmtDateTime(e.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
