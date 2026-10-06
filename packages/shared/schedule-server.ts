// Server-only live schedule query. Separated from lib/schedule.ts because
// that file is also imported by client components, and this module pulls in
// next/headers via the Supabase server client.
import 'server-only'

import { createClient } from './supabase/server'
import { getActiveTeam } from './teams'
import { addDays, type Employee, type Shift } from './schedule'

export async function getLiveWeekSchedule(
  weekStart: Date
): Promise<{ employees: Employee[]; shifts: Shift[] }> {
  const activeTeam = await getActiveTeam()
  if (!activeTeam) return { employees: [], shifts: [] }

  const supabase = await createClient()
  const end = addDays(weekStart, 7)

  const [{ data: employees }, { data: shifts }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, name, email, role')
      .eq('team_id', activeTeam.id)
      .order('name'),
    supabase
      .from('shifts')
      .select('id, employee_id, starts_at, ends_at, published')
      .eq('team_id', activeTeam.id)
      .gte('starts_at', weekStart.toISOString())
      .lt('starts_at', end.toISOString())
      .order('starts_at'),
  ])

  return {
    employees: (employees ?? []) as Employee[],
    shifts: (shifts ?? []) as Shift[],
  }
}
