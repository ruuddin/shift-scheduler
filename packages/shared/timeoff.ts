import { getReader, getWriter } from './db'

export type TimeOffStatus = 'pending' | 'approved' | 'declined' | 'cancelled'

export type TimeOffRequest = {
  id: string
  org_id: string
  team_id: string
  employee_id: string
  employee_name: string | null
  starts_on: string
  ends_on: string
  reason: string | null
  status: TimeOffStatus
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export type Availability = {
  weekday: number // 0 = Sunday
  available: boolean
  unavailable_from: string | null
  unavailable_to: string | null
}

type TimeOffRow = {
  id: string
  org_id: string
  team_id: string
  employee_id: string
  starts_on: string
  ends_on: string
  reason: string | null
  status: TimeOffStatus
  decided_by: string | null
  decided_at: string | null
  created_at: string
  employees: { name: string } | null
}

const SELECT =
  'id, org_id, team_id, employee_id, starts_on, ends_on, reason, status, decided_by, decided_at, created_at, employees(name)'

function toTimeOff(r: TimeOffRow): TimeOffRequest {
  return {
    id: r.id,
    org_id: r.org_id,
    team_id: r.team_id,
    employee_id: r.employee_id,
    employee_name: r.employees?.name ?? null,
    starts_on: r.starts_on,
    ends_on: r.ends_on,
    reason: r.reason,
    status: r.status,
    decided_by: r.decided_by,
    decided_at: r.decided_at,
    created_at: r.created_at,
  }
}

/**
 * Time-off requests visible in a team:
 * - managers: every request in the team (pending first)
 * - employees: their own requests
 */
export async function listTimeOffRequests(opts: {
  userId: string
  teamId: string
  isManager: boolean
  includeDecided?: boolean
}): Promise<TimeOffRequest[]> {
  const reader = await getReader()
  const { data: empRows } = await reader
    .from('employees')
    .select('id')
    .eq('user_id', opts.userId)
    .eq('team_id', opts.teamId)
  const myEmployeeIds = ((empRows ?? []) as { id: string }[]).map((r) => r.id)
  if (myEmployeeIds.length === 0 && !opts.isManager) return []

  let query = reader
    .from('time_off_requests')
    .select(SELECT)
    .eq('team_id', opts.teamId)
    .order('starts_on', { ascending: true })
    .limit(100)

  if (!opts.isManager) {
    query = query.in('employee_id', myEmployeeIds)
  }
  if (!opts.includeDecided) {
    query = query.eq('status', 'pending')
  }

  const { data } = await query
  const reqs = ((data ?? []) as unknown as TimeOffRow[]).map(toTimeOff)
  reqs.sort((a, b) => {
    const pa = a.status === 'pending' ? 0 : 1
    const pb = b.status === 'pending' ? 0 : 1
    if (pa !== pb) return pa - pb
    return a.starts_on.localeCompare(b.starts_on)
  })
  return reqs
}

/** Approved time off overlapping a date range — for scheduling conflict display. */
export async function getApprovedTimeOffInRange(
  teamId: string,
  from: string,
  to: string
): Promise<TimeOffRequest[]> {
  const reader = await getReader()
  const { data } = await reader
    .from('time_off_requests')
    .select(SELECT)
    .eq('team_id', teamId)
    .eq('status', 'approved')
    .lte('starts_on', to)
    .gte('ends_on', from)
    .order('starts_on', { ascending: true })
    .limit(100)
  return ((data ?? []) as unknown as TimeOffRow[]).map(toTimeOff)
}

export async function getTimeOffRequest(id: string): Promise<TimeOffRequest | null> {
  const reader = await getReader()
  const { data } = await reader
    .from('time_off_requests')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  return toTimeOff(data as unknown as TimeOffRow)
}

export type NewTimeOffRequest = {
  orgId: string
  teamId: string
  employeeId: string
  startsOn: string
  endsOn: string
  reason: string | null
}

export async function createTimeOffRequest(input: NewTimeOffRequest): Promise<string> {
  const writer = await getWriter()
  const { data, error } = await writer
    .from('time_off_requests')
    .insert({
      org_id: input.orgId,
      team_id: input.teamId,
      employee_id: input.employeeId,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      reason: input.reason,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function decideTimeOffRequest(opts: {
  id: string
  approve: boolean
  deciderEmployeeId: string
}): Promise<void> {
  const writer = await getWriter()
  const reader = await getReader()
  const { data: row } = await reader
    .from('time_off_requests')
    .select('id, status')
    .eq('id', opts.id)
    .single()
  const req = row as { id: string; status: TimeOffStatus } | null
  if (!req) throw new Error('Request not found.')
  if (req.status !== 'pending') throw new Error('This request was already decided.')
  const { error } = await writer
    .from('time_off_requests')
    .update({
      status: opts.approve ? 'approved' : 'declined',
      decided_by: opts.deciderEmployeeId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', opts.id)
  if (error) throw new Error(error.message)
}

export async function cancelTimeOffRequest(id: string, employeeId: string): Promise<void> {
  const writer = await getWriter()
  const { error } = await writer
    .from('time_off_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('employee_id', employeeId)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)
}

/** Weekly availability template for one employee (7 rows, Sunday-first). */
export async function getAvailability(
  employeeId: string
): Promise<Availability[]> {
  const reader = await getReader()
  const { data } = await reader
    .from('employee_availability')
    .select('weekday, available, unavailable_from, unavailable_to')
    .eq('employee_id', employeeId)
    .order('weekday')
  const rows = (data ?? []) as Availability[]
  const byDay = new Map(rows.map((r) => [r.weekday, r]))
  return Array.from({ length: 7 }, (_, d) => ({
    weekday: d,
    available: byDay.get(d)?.available ?? true,
    unavailable_from: byDay.get(d)?.unavailable_from ?? null,
    unavailable_to: byDay.get(d)?.unavailable_to ?? null,
  }))
}

/** Replace the employee's whole weekly template. */
export async function setAvailability(opts: {
  employeeId: string
  teamId: string
  orgId: string
  days: Availability[]
}): Promise<void> {
  const writer = await getWriter()
  for (const d of opts.days) {
    if (d.weekday < 0 || d.weekday > 6) throw new Error('Bad weekday.')
    const { error } = await writer.from('employee_availability').upsert(
      {
        employee_id: opts.employeeId,
        team_id: opts.teamId,
        org_id: opts.orgId,
        weekday: d.weekday,
        available: d.available,
        unavailable_from: d.available ? d.unavailable_from : null,
        unavailable_to: d.available ? d.unavailable_to : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,weekday' }
    )
    if (error) throw new Error(error.message)
  }
}

/** Availability for every employee in a team (manager view). */
export async function getTeamAvailability(
  teamId: string
): Promise<{ employee_id: string; employee_name: string; days: Availability[] }[]> {
  const reader = await getReader()
  const { data: emps } = await reader
    .from('employees')
    .select('id, name')
    .eq('team_id', teamId)
    .order('name')
  const employees = (emps ?? []) as { id: string; name: string }[]
  if (employees.length === 0) return []
  const { data: rows } = await reader
    .from('employee_availability')
    .select('employee_id, weekday, available, unavailable_from, unavailable_to')
    .eq('team_id', teamId)
  const byEmp = new Map<string, Map<number, Availability>>()
  for (const r of (rows ?? []) as (Availability & { employee_id: string })[]) {
    if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, new Map())
    byEmp.get(r.employee_id)!.set(r.weekday, {
      weekday: r.weekday,
      available: r.available,
      unavailable_from: r.unavailable_from,
      unavailable_to: r.unavailable_to,
    })
  }
  return employees.map((e) => ({
    employee_id: e.id,
    employee_name: e.name,
    days: Array.from({ length: 7 }, (_, d) => ({
      weekday: d,
      available: byEmp.get(e.id)?.get(d)?.available ?? true,
      unavailable_from: byEmp.get(e.id)?.get(d)?.unavailable_from ?? null,
      unavailable_to: byEmp.get(e.id)?.get(d)?.unavailable_to ?? null,
    })),
  }))
}
