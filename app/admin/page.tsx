import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventsAction } from '@/app/event-actions'
import {
  ALL_EVENT_TYPES,
  describeEvent,
  eventLabel,
} from '@/lib/events'

export const metadata = {
  title: 'Admin — event history — Shift Scheduler',
}

type SearchParams = {
  type?: string
  q?: string
  from?: string
  to?: string
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function filterHref(base: SearchParams, patch: Partial<SearchParams>): string {
  const merged = { ...base, ...patch }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return `/admin${qs ? `?${qs}` : ''}`
}

// Manager-only: full history of everything that happened in the team.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!preview) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    const { getActiveTeam, getMyTeams } = await import('@/app/team-actions')
    const activeTeam = await getActiveTeam()
    const teams = await getMyTeams()
    const role = teams.find((t) => t.id === activeTeam?.id)?.role
    if (role !== 'manager') redirect('/dashboard')
  }

  const sp = await searchParams
  const filters: SearchParams = {
    type: sp.type || undefined,
    q: sp.q || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
  }

  const { events, preview: isPreview } = await getEventsAction(filters)

  const today = new Date().toISOString().slice(0, 10)
  const todayCount = events.filter((e) => e.created_at.slice(0, 10) === today).length
  const byType = ALL_EVENT_TYPES.map((t) => ({
    type: t,
    count: events.filter((e) => e.event_type === t).length,
  })).filter((x) => x.count > 0)
  const actors = new Set(events.map((e) => e.actor_email).filter(Boolean)).size

  return (
    <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-6 md:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-zinc-500">
            Full history of everything that happened on your team.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/roster"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            ← Roster
          </Link>
          <Link
            href="/guide/admin"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Guide
          </Link>
        </div>
      </div>

      {isPreview && (
        <p className="mb-4 break-words rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Preview mode — history is kept in memory and resets when the server
          restarts. Connect Supabase keys to keep a permanent log.
        </p>
      )}

      {/* Analytics summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-2xl font-bold">{events.length}</div>
          <div className="text-sm text-zinc-500">Total events</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-2xl font-bold">{todayCount}</div>
          <div className="text-sm text-zinc-500">Today</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-2xl font-bold">{actors}</div>
          <div className="text-sm text-zinc-500">Active people</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-2xl font-bold">{byType.length}</div>
          <div className="text-sm text-zinc-500">Event types seen</div>
        </div>
      </div>

      {byType.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Activity breakdown</h2>
          <div className="flex flex-wrap gap-2">
            {byType.map(({ type, count }) => {
              const active = filters.type === type
              return (
                <Link
                  key={type}
                  href={filterHref(filters, { type: active ? '' : type })}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    active
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'hover:bg-zinc-50'
                  }`}
                >
                  {eventLabel(type)} · {count}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <form
        method="get"
        action="/admin"
        className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border bg-white p-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Event type</span>
          <select
            name="type"
            defaultValue={filters.type ?? ''}
            className="rounded-md border px-3 py-2"
          >
            <option value="">All types</option>
            {ALL_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {eventLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Search</span>
          <input
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="email, shift id, details…"
            className="w-52 rounded-md border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">From</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ''}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">To</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ''}
            className="rounded-md border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          Filter
        </button>
        {(filters.type || filters.q || filters.from || filters.to) && (
          <Link
            href="/admin"
            className="rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Event history */}
      {events.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="font-medium">No events yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Actions like signing in, inviting teammates, and editing shifts will
            appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 text-xs uppercase text-zinc-500">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Who</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                    {fmtTime(e.created_at)}
                  </td>
                  <td className="max-w-45 truncate px-4 py-3">
                    {e.actor_email ?? '—'}
                    {e.actor_role && (
                      <span className="ml-1 text-xs text-zinc-400">
                        · {e.actor_role}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium">
                      {eventLabel(e.event_type)}
                    </span>
                  </td>
                  <td className="max-w-75 truncate px-4 py-3 text-zinc-600">
                    {describeEvent(e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-400">
        Showing {events.length} event{events.length === 1 ? '' : 's'}, newest first.
      </p>
    </main>
  )
}
