import { Fragment } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getWeekSchedule,
  startOfWeekMonday,
  toISODate,
  addDays,
  fmtDay,
  fmtTime,
  colorFor,
} from '@/lib/schedule'

function parseWeek(param: string | undefined): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const d = new Date(param + 'T00:00:00Z')
    if (!isNaN(d.getTime())) return startOfWeekMonday(d)
  }
  return startOfWeekMonday(new Date())
}

// Manager-only weekly roster grid. Drag-and-drop assignment lands Day 5.
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
    if (user.user_metadata?.role !== 'manager') redirect('/dashboard')
  }

  const params = await searchParams
  const weekStart = parseWeek(params.week)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const { employees, shifts } = await getWeekSchedule(weekStart)
  const staff = employees.filter((e) => e.role === 'employee')

  const prevWeek = toISODate(addDays(weekStart, -7))
  const nextWeek = toISODate(addDays(weekStart, 7))

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Roster</h1>
          <p className="text-sm text-zinc-500">
            {fmtDay(days[0])} – {fmtDay(days[6])}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
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
        <p className="mb-4 rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Preview mode — add Supabase keys to <code>.env.local</code> for real data
          and login enforcement.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <div
          className="grid min-w-[900px]"
          style={{ gridTemplateColumns: '160px repeat(7, minmax(0, 1fr))' }}
        >
          <div className="border-b bg-zinc-50 p-3" />
          {days.map((d) => (
            <div key={toISODate(d)} className="border-b border-l bg-zinc-50 p-2 text-center">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                {fmtDay(d).split(' ')[0]}
              </div>
              <div className="text-sm font-medium">{fmtDay(d).split(' ').slice(1).join(' ')}</div>
            </div>
          ))}

          {staff.map((emp, ei) => (
            <Fragment key={emp.id}>
              <div className="border-b p-3">
                <div className="font-medium">{emp.name}</div>
                <div className="text-xs text-zinc-500">{emp.email}</div>
              </div>
              {days.map((day) => {
                const iso = toISODate(day)
                const dayShifts = shifts.filter(
                  (sh) => sh.employee_id === emp.id && sh.starts_at.slice(0, 10) === iso
                )
                return (
                  <div key={emp.id + iso} className="min-h-20 border-b border-l p-1.5">
                    {dayShifts.map((sh) => (
                      <div
                        key={sh.id}
                        className={`mb-1 rounded border px-2 py-1 text-xs font-medium ${colorFor(ei)}`}
                      >
                        {fmtTime(sh.starts_at)}–{fmtTime(sh.ends_at)}
                      </div>
                    ))}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        Drag-and-drop scheduling lands Day 5 — this grid is read-only for now.
      </p>
    </main>
  )
}
