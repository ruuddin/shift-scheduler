// Schedule data layer.
// Day 4: serves mock data (mirrors supabase/seed.sql) so the UI builds without
// live keys. Swap getWeekSchedule's body for a Supabase query once .env.local
// is filled in — the return shape stays the same.

export type Employee = { id: string; name: string; email: string; role: string }
export type Shift = {
  id: string
  employee_id: string
  starts_at: string // ISO
  ends_at: string // ISO
  published: boolean
}

export const mockEmployees: Employee[] = [
  { id: '22222222-2222-2222-2222-222222222222', name: 'Ava Manager', email: 'manager@demo.cafe', role: 'manager' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Ben Barista', email: 'ben@demo.cafe', role: 'employee' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Cara Cashier', email: 'cara@demo.cafe', role: 'employee' },
]

const BEN = '33333333-3333-3333-3333-333333333333'
const CARA = '44444444-4444-4444-4444-444444444444'

function s(day: string, start: string, end: string, emp: string, i: number): Shift {
  return {
    id: `55555555-5555-5555-5555-5555555555${String(i).padStart(2, '0')}`,
    employee_id: emp,
    starts_at: `${day}T${start}:00Z`,
    ends_at: `${day}T${end}:00Z`,
    published: true,
  }
}

// Same week as supabase/seed.sql: Mon 2026-10-05 → Sun 2026-10-11
export const mockShifts: Shift[] = [
  s('2026-10-05', '07:00', '15:00', BEN, 1),
  s('2026-10-05', '11:00', '19:00', CARA, 2),
  s('2026-10-06', '07:00', '15:00', BEN, 3),
  s('2026-10-06', '11:00', '19:00', CARA, 4),
  s('2026-10-07', '07:00', '15:00', CARA, 5),
  s('2026-10-07', '11:00', '19:00', BEN, 6),
  s('2026-10-08', '07:00', '15:00', BEN, 7),
  s('2026-10-08', '11:00', '19:00', CARA, 8),
  s('2026-10-09', '07:00', '15:00', BEN, 9),
  s('2026-10-09', '11:00', '21:00', CARA, 10),
  s('2026-10-10', '08:00', '16:00', BEN, 11),
  s('2026-10-10', '12:00', '20:00', CARA, 12),
  s('2026-10-11', '08:00', '16:00', CARA, 13),
]

export async function getWeekSchedule(
  weekStart: Date
): Promise<{ employees: Employee[]; shifts: Shift[] }> {
  // TODO(Day 4 wiring): replace with live Supabase query, e.g.
  //   const supabase = await createClient()
  //   const { data: shifts } = await supabase.from('shifts')
  //     .select('*').gte('starts_at', weekStart.toISOString())
  //     .lt('starts_at', addDays(weekStart, 7).toISOString())
  const end = addDays(weekStart, 7)
  const shifts = mockShifts.filter((sh) => {
    const t = new Date(sh.starts_at).getTime()
    return t >= weekStart.getTime() && t < end.getTime()
  })
  return { employees: mockEmployees, shifts }
}

// ---- week + formatting helpers (all UTC so server/client agree) ----

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = x.getUTCDay() // 0 = Sunday
  x.setUTCDate(x.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return x
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  let h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const ap = h >= 12 ? 'p' : 'a'
  h = h % 12 === 0 ? 12 : h % 12
  return `${h}${m ? ':' + String(m).padStart(2, '0') : ''}${ap}`
}

const COLORS = [
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-amber-100 border-amber-300 text-amber-900',
  'bg-emerald-100 border-emerald-300 text-emerald-900',
  'bg-violet-100 border-violet-300 text-violet-900',
]

export function colorFor(index: number): string {
  return COLORS[index % COLORS.length]
}
