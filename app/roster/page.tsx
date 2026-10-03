import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getMockWeekSchedule,
  startOfWeekMonday,
  toISODate,
  addDays,
  fmtDay,
} from '@/lib/schedule'
import { getLiveWeekSchedule } from '@/lib/schedule-server'
import RosterGrid from './RosterGrid'
import GuidedTour from './GuidedTour'
import { isFlagEnabled } from '@/lib/flags'

function parseWeek(param: string | undefined): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const d = new Date(param + 'T00:00:00Z')
    if (!isNaN(d.getTime())) return startOfWeekMonday(d)
  }
  return startOfWeekMonday(new Date())
}

// Manager-only weekly roster. Scheduling interactions live in RosterGrid;
// persistence goes through server actions (Supabase) once keys are live.
export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
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

  const params = await searchParams
  const weekStart = parseWeek(params.week)
  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)))
  const { employees, shifts } = preview
    ? getMockWeekSchedule(weekStart)
    : await getLiveWeekSchedule(weekStart)
  const staff = employees.filter((e) => e.role === 'employee')

  const prevWeek = toISODate(addDays(weekStart, -7))
  const nextWeek = toISODate(addDays(weekStart, 7))
  const dndEnabled = isFlagEnabled('dnd-scheduling')
  const crudEnabled = isFlagEnabled('shift-crud')
  const tourEnabled = isFlagEnabled('guided-tour')

  return (
    <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-6 md:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Roster</h1>
          <p className="text-sm text-zinc-500">
            {fmtDay(new Date(days[0] + 'T00:00:00Z'))} –{' '}
            {fmtDay(new Date(days[6] + 'T00:00:00Z'))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm" data-tour="week-nav">
          <GuidedTour enabled={tourEnabled} dndEnabled={dndEnabled} crudEnabled={crudEnabled} />
          <Link
            href="/guide"
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Guides
          </Link>
          <Link
            href={`/roster?week=${prevWeek}`}
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            ← Prev
          </Link>
          <Link href="/roster" className="rounded-md border px-3 py-1.5 hover:bg-zinc-50">
            This week
          </Link>
          <Link
            href={`/roster?week=${nextWeek}`}
            className="rounded-md border px-3 py-1.5 hover:bg-zinc-50"
          >
            Next →
          </Link>
        </div>
      </div>

      {preview && (
        <p className="mb-4 break-words rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Preview mode — schedule edits are kept in this session only. Add Supabase
          keys to <code>.env.local</code> to persist them.
        </p>
      )}

      <RosterGrid
        employees={staff}
        initialShifts={shifts}
        days={days}
        preview={preview}
        dndEnabled={dndEnabled}
        crudEnabled={crudEnabled}
      />

      <p className="mt-4 break-words text-sm text-zinc-500 md:hidden">
        {crudEnabled
          ? 'Tap a shift to edit or delete it • tap + Add on a teammate to add one.'
          : 'Shifts are read-only.'}
      </p>
      <p className="mt-4 hidden break-words text-sm text-zinc-500 md:block">
        {dndEnabled
          ? 'Drag a shift to move it to another day or employee'
          : 'Drag-and-drop is currently disabled'}
        {crudEnabled
          ? ' • click a shift to edit or delete it • click an empty cell to add one.'
          : '.'}
      </p>
    </main>
  )
}
