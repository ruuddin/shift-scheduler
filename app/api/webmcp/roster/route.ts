// WebMCP data route — GET /api/webmcp/roster?week=YYYY-MM-DD
//
// Read-only, and scoped exactly like the /roster page:
//   1. week format validated FIRST (a 400 here leaks nothing and is
//      testable without a session).
//   2. signed-in user required, else 401.
//   3. manager of the active team required (requireOrgManagerForActiveTeam),
//      else 403 — employees never see another view through this route.
//   4. data via getLiveWeekSchedule: active team only, one week.
// Output strips everything an agent doesn't need: no emails, no row IDs,
// no shift notes — names, roles, and shift times only. Shift times are
// HH:MM UTC as stored.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveTeam } from '@/lib/teams'
import { getLiveWeekSchedule } from '@/lib/schedule-server'
import { startOfWeekMonday, toISODate, addDays } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_SHIFTS = 200

export async function GET(req: NextRequest) {
  const weekParam = req.nextUrl.searchParams.get('week')
  let weekStart: Date
  if (weekParam) {
    if (!WEEK_RE.test(weekParam)) {
      return NextResponse.json(
        { error: 'week must be a date as YYYY-MM-DD' },
        { status: 400 }
      )
    }
    const d = new Date(weekParam + 'T00:00:00Z')
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: 'week must be a valid date' },
        { status: 400 }
      )
    }
    weekStart = startOfWeekMonday(d)
  } else {
    weekStart = startOfWeekMonday(new Date())
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { requireOrgManagerForActiveTeam } = await import('@/lib/orgs')
  try {
    await requireOrgManagerForActiveTeam()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const team = await getActiveTeam()
  const { employees, shifts } = await getLiveWeekSchedule(weekStart)

  const members = new Map<
    string,
    {
      name: string
      role: string
      shifts: { day: string; start: string; end: string; published: boolean }[]
    }
  >()
  for (const e of employees) {
    members.set(e.id, { name: e.name, role: e.role, shifts: [] })
  }
  for (const s of shifts.slice(0, MAX_SHIFTS)) {
    const m = members.get(s.employee_id)
    if (m) {
      m.shifts.push({
        day: s.starts_at.slice(0, 10),
        start: s.starts_at.slice(11, 16),
        end: s.ends_at.slice(11, 16),
        published: s.published,
      })
    }
  }

  return NextResponse.json({
    week_start: toISODate(weekStart),
    week_end: toISODate(addDays(weekStart, 6)),
    team_name: team?.name ?? null,
    shift_count: shifts.length,
    truncated: shifts.length > MAX_SHIFTS,
    members: [...members.values()],
  })
}
