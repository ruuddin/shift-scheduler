import { getReader, getWriter } from './db'

export type SwapStatus = 'pending' | 'approved' | 'declined' | 'cancelled'

export type SwapRequest = {
  id: string
  org_id: string
  team_id: string
  team_name: string | null
  shift_id: string
  shift_starts_at: string
  shift_ends_at: string
  requested_by: string
  requester_name: string | null
  target_employee_id: string | null
  target_name: string | null
  target_shift_id: string | null
  target_shift_starts_at: string | null
  target_shift_ends_at: string | null
  note: string | null
  status: SwapStatus
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

type SwapRow = {
  id: string
  org_id: string
  team_id: string
  shift_id: string
  requested_by: string
  target_employee_id: string | null
  target_shift_id: string | null
  note: string | null
  status: SwapStatus
  decided_by: string | null
  decided_at: string | null
  created_at: string
  teams: { name: string } | null
}

const SELECT =
  'id, org_id, team_id, shift_id, requested_by, target_employee_id, target_shift_id, note, status, decided_by, decided_at, created_at, teams(name)'

function toSwap(
  r: SwapRow,
  names: Map<string, string>,
  shiftTimes: Map<string, { starts_at: string; ends_at: string }>
): SwapRequest {
  const t = shiftTimes.get(r.shift_id)
  const tt = r.target_shift_id ? shiftTimes.get(r.target_shift_id) : undefined
  return {
    id: r.id,
    org_id: r.org_id,
    team_id: r.team_id,
    team_name: r.teams?.name ?? null,
    shift_id: r.shift_id,
    shift_starts_at: t?.starts_at ?? '',
    shift_ends_at: t?.ends_at ?? '',
    requested_by: r.requested_by,
    requester_name: names.get(r.requested_by) ?? null,
    target_employee_id: r.target_employee_id,
    target_name: r.target_employee_id
      ? (names.get(r.target_employee_id) ?? null)
      : null,
    target_shift_id: r.target_shift_id,
    target_shift_starts_at: tt?.starts_at ?? null,
    target_shift_ends_at: tt?.ends_at ?? null,
    note: r.note,
    status: r.status,
    decided_by: r.decided_by,
    decided_at: r.decided_at,
    created_at: r.created_at,
  }
}

async function enrich(
  reader: Awaited<ReturnType<typeof getReader>>,
  rows: SwapRow[]
): Promise<SwapRequest[]> {
  const empIds = [
    ...new Set(
      rows.flatMap((r) =>
        [r.requested_by, r.target_employee_id].filter(Boolean)
      ) as string[],
    ),
  ]
  const shiftIds = [
    ...new Set(
      rows.flatMap((r) => [r.shift_id, r.target_shift_id].filter(Boolean)) as string[],
    ),
  ]
  const names = new Map<string, string>()
  if (empIds.length > 0) {
    const { data } = await reader.from('employees').select('id, name').in('id', empIds)
    for (const e of (data ?? []) as { id: string; name: string }[]) names.set(e.id, e.name)
  }
  const shiftTimes = new Map<string, { starts_at: string; ends_at: string }>()
  if (shiftIds.length > 0) {
    const { data } = await reader
      .from('shifts')
      .select('id, starts_at, ends_at')
      .in('id', shiftIds)
    for (const s of (data ?? []) as { id: string; starts_at: string; ends_at: string }[])
      shiftTimes.set(s.id, { starts_at: s.starts_at, ends_at: s.ends_at })
  }
  return rows.map((r) => toSwap(r, names, shiftTimes))
}

/**
 * Swap requests visible to a user in a team:
 * - managers: every request in the team
 * - employees: requests they made + requests targeting them
 * Pending first, then newest.
 */
export async function listSwapRequests(opts: {
  userId: string
  teamId: string
  isManager: boolean
  includeDecided?: boolean
}): Promise<SwapRequest[]> {
  const reader = await getReader()
  const { data: empRows } = await reader
    .from('employees')
    .select('id')
    .eq('user_id', opts.userId)
    .eq('team_id', opts.teamId)
  const myEmployeeIds = ((empRows ?? []) as { id: string }[]).map((r) => r.id)
  if (myEmployeeIds.length === 0 && !opts.isManager) return []

  let query = reader
    .from('swap_requests')
    .select(SELECT)
    .eq('team_id', opts.teamId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!opts.isManager) {
    const ids = myEmployeeIds.join(',')
    query = query.or(`requested_by.in.(${ids}),target_employee_id.in.(${ids})`)
  }
  if (!opts.includeDecided) {
    query = query.eq('status', 'pending')
  }

  const { data } = await query
  const swaps = await enrich(reader, (data ?? []) as unknown as SwapRow[])
  swaps.sort((a, b) => {
    const pa = a.status === 'pending' ? 0 : 1
    const pb = b.status === 'pending' ? 0 : 1
    if (pa !== pb) return pa - pb
    return b.created_at.localeCompare(a.created_at)
  })
  return swaps
}

/** The employee row id for a user in a team (null when not on the team). */
export async function getEmployeeIdForUser(
  userId: string,
  teamId: string
): Promise<string | null> {
  const reader = await getReader()
  const { data } = await reader
    .from('employees')
    .select('id')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/** Upcoming published shifts of one employee in a team (for the swap picker). */
export async function getUpcomingShiftsForEmployee(
  employeeId: string,
  teamId: string,
  limit = 20
): Promise<{ id: string; starts_at: string; ends_at: string }[]> {
  const reader = await getReader()
  const { data } = await reader
    .from('shifts')
    .select('id, starts_at, ends_at')
    .eq('employee_id', employeeId)
    .eq('team_id', teamId)
    .eq('published', true)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as { id: string; starts_at: string; ends_at: string }[]
}

/** Other employees in the team (possible swap targets). */
export async function getCoworkers(
  teamId: string,
  excludeEmployeeId: string
): Promise<{ id: string; name: string }[]> {
  const reader = await getReader()
  const { data } = await reader
    .from('employees')
    .select('id, name')
    .eq('team_id', teamId)
    .neq('id', excludeEmployeeId)
    .order('name')
  return (data ?? []) as { id: string; name: string }[]
}

/** True when the employee already has a shift overlapping [start, end). */
export async function hasOverlappingShift(
  employeeId: string,
  startsAt: string,
  endsAt: string,
  excludeShiftId?: string
): Promise<boolean> {
  const reader = await getReader()
  let query = reader
    .from('shifts')
    .select('id')
    .eq('employee_id', employeeId)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt)
    .limit(1)
  if (excludeShiftId) query = query.neq('id', excludeShiftId)
  const { data } = await query
  return (data?.length ?? 0) > 0
}

export type NewSwapRequest = {
  orgId: string
  teamId: string
  shiftId: string
  requestedBy: string
  targetEmployeeId: string | null
  targetShiftId: string | null
  note: string | null
}

export async function createSwapRequest(input: NewSwapRequest): Promise<string> {
  const writer = await getWriter()
  const { data, error } = await writer
    .from('swap_requests')
    .insert({
      org_id: input.orgId,
      team_id: input.teamId,
      shift_id: input.shiftId,
      requested_by: input.requestedBy,
      target_employee_id: input.targetEmployeeId,
      target_shift_id: input.targetShiftId,
      note: input.note,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function getSwapRequest(id: string): Promise<SwapRequest | null> {
  const reader = await getReader()
  const { data } = await reader
    .from('swap_requests')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const [swap] = await enrich(reader, [data as unknown as SwapRow])
  return swap
}

/**
 * Apply a manager decision. On approve the shift(s) change hands:
 * - giveaway (no target_shift_id): shift -> target employee
 * - mutual swap: the two shifts trade employees
 */
export async function decideSwapRequest(opts: {
  id: string
  approve: boolean
  deciderEmployeeId: string
  assigneeEmployeeId?: string | null
}): Promise<SwapRequest> {
  const writer = await getWriter()
  const reader = await getReader()

  const { data: row, error: readError } = await reader
    .from('swap_requests')
    .select('id, shift_id, requested_by, target_employee_id, target_shift_id, status, team_id')
    .eq('id', opts.id)
    .single()
  if (readError || !row) throw new Error('Swap request not found.')
  const req = row as {
    id: string
    shift_id: string
    requested_by: string
    target_employee_id: string | null
    target_shift_id: string | null
    status: SwapStatus
    team_id: string
  }
  if (req.status !== 'pending') throw new Error('This request was already decided.')

  if (opts.approve) {
    const assignee = opts.assigneeEmployeeId ?? req.target_employee_id
    if (!assignee) throw new Error('Choose who takes the shift.')
    // Re-read the shift to make sure it still belongs to the requester.
    const { data: shift } = await reader
      .from('shifts')
      .select('id, employee_id, starts_at, ends_at')
      .eq('id', req.shift_id)
      .single()
    const s = shift as {
      id: string
      employee_id: string | null
      starts_at: string
      ends_at: string
    } | null
    if (!s || s.employee_id !== req.requested_by) {
      throw new Error('The shift changed hands already — reassign it directly from the roster.')
    }
    if (await hasOverlappingShift(assignee, s.starts_at, s.ends_at, s.id)) {
      throw new Error('That would double-book the assignee — pick someone else.')
    }
    if (req.target_shift_id) {
      const { data: tshift } = await reader
        .from('shifts')
        .select('id, employee_id, starts_at, ends_at')
        .eq('id', req.target_shift_id)
        .single()
      const t = tshift as {
        id: string
        employee_id: string | null
        starts_at: string
        ends_at: string
      } | null
      if (!t || t.employee_id !== assignee) {
        throw new Error('The trade shift changed hands already.')
      }
      if (await hasOverlappingShift(req.requested_by, t.starts_at, t.ends_at, t.id)) {
        throw new Error('That would double-book the requester — pick a different trade.')
      }
      const { error: e1 } = await writer
        .from('shifts')
        .update({ employee_id: t.employee_id })
        .eq('id', s.id)
      if (e1) throw new Error(e1.message)
      const { error: e2 } = await writer
        .from('shifts')
        .update({ employee_id: s.employee_id })
        .eq('id', t.id)
      if (e2) throw new Error(e2.message)
    } else {
      const { error } = await writer.from('shifts').update({ employee_id: assignee }).eq('id', s.id)
      if (error) throw new Error(error.message)
    }
  }

  const { error: updateError } = await writer
    .from('swap_requests')
    .update({
      status: opts.approve ? 'approved' : 'declined',
      decided_by: opts.deciderEmployeeId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', opts.id)
  if (updateError) throw new Error(updateError.message)

  const updated = await getSwapRequest(opts.id)
  if (!updated) throw new Error('Swap request not found.')
  return updated
}

/** Requester cancels their own pending request. */
export async function cancelSwapRequest(id: string, employeeId: string): Promise<void> {
  const writer = await getWriter()
  const { error } = await writer
    .from('swap_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('requested_by', employeeId)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)
}
