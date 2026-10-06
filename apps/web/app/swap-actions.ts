'use server'

import { logEventAction } from '@shift-scheduler/shared/event-actions'
import { getActiveTeam } from '@/app/team-actions'
import {
  cancelSwapRequest,
  createSwapRequest,
  decideSwapRequest,
  getCoworkers,
  getEmployeeIdForUser,
  getUpcomingShiftsForEmployee,
  getSwapRequest,
  listSwapRequests,
  type SwapRequest,
} from '@shift-scheduler/shared/swaps'
import { isFlagEnabledForTeam } from '@shift-scheduler/shared/flags'
import { getActiveOrg, isOrgManager } from '@shift-scheduler/shared/orgs'
import { createClient } from '@shift-scheduler/shared/supabase/server'
import { getReader } from '@shift-scheduler/shared/db'

async function signedIn() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return { user }
}

async function teamContext() {
  const { user } = await signedIn()
  const team = await getActiveTeam()
  if (!team) throw new Error('No active team.')
  const org = await getActiveOrg()
  if (!org) throw new Error('No organization found.')
  const enabled = await isFlagEnabledForTeam('shift-swaps', team.id, user.id)
  if (!enabled) throw new Error('Shift swaps are disabled.')
  const manager = await isOrgManager(user.id, org.id)
  const employeeId = await getEmployeeIdForUser(user.id, team.id)
  return { user, team, org, manager, employeeId }
}

export type SwapsHub = {
  swaps: SwapRequest[]
  canManage: boolean
  myEmployeeId: string | null
  myShifts: { id: string; starts_at: string; ends_at: string }[]
  coworkers: { id: string; name: string }[]
  enabled: boolean
  preview: boolean
}

/** Data for the /swaps hub. Returns disabled state when the flag is off. */
export async function getSwapsAction(): Promise<SwapsHub> {
  const empty: SwapsHub = {
    swaps: [],
    canManage: false,
    myEmployeeId: null,
    myShifts: [],
    coworkers: [],
    enabled: false,
    preview: !process.env.NEXT_PUBLIC_SUPABASE_URL,
  }
  if (empty.preview) return empty
  const { user, team, manager, employeeId } = await teamContext().catch(() => ({
    user: null as never,
    team: null as never,
    manager: false,
    employeeId: null as string | null,
  }))
  if (!user || !team) return empty
  const enabled = await isFlagEnabledForTeam('shift-swaps', team.id, user.id).catch(
    () => false
  )
  if (!enabled) return empty
  const swaps = await listSwapRequests({
    userId: user.id,
    teamId: team.id,
    isManager: manager,
  })
  const myShifts = employeeId
    ? await getUpcomingShiftsForEmployee(employeeId, team.id)
    : []
  const coworkers = employeeId ? await getCoworkers(team.id, employeeId) : []
  return {
    swaps,
    canManage: manager,
    myEmployeeId: employeeId,
    myShifts,
    coworkers,
    enabled: true,
    preview: false,
  }
}

export async function requestSwapAction(input: {
  shiftId: string
  targetEmployeeId?: string | null
  targetShiftId?: string | null
  note?: string
}): Promise<{ ok: true; id: string }> {
  const { user, team, org, employeeId } = await teamContext()
  if (!employeeId) throw new Error('You are not on this team.')

  const reader = await getReader()
  const { data: shift } = await reader
    .from('shifts')
    .select('id, employee_id, team_id, starts_at, published')
    .eq('id', input.shiftId)
    .single()
  const s = shift as {
    id: string
    employee_id: string | null
    team_id: string
    starts_at: string
    published: boolean
  } | null
  if (!s || s.team_id !== team.id) throw new Error('Shift not found.')
  if (s.employee_id !== employeeId) throw new Error('That is not your shift.')
  if (!s.published) throw new Error('Only published shifts can be swapped.')
  if (new Date(s.starts_at).getTime() <= Date.now()) {
    throw new Error('Past shifts cannot be swapped.')
  }

  // No duplicate pending request for the same shift.
  const { data: dup } = await reader
    .from('swap_requests')
    .select('id')
    .eq('shift_id', input.shiftId)
    .eq('status', 'pending')
    .limit(1)
  if ((dup?.length ?? 0) > 0) throw new Error('You already have a pending request for this shift.')

  const targetEmployeeId: string | null = input.targetEmployeeId ?? null
  let targetShiftId: string | null = input.targetShiftId ?? null
  if (targetEmployeeId) {
    if (targetEmployeeId === employeeId) throw new Error('Pick someone else.')
    const { data: t } = await reader
      .from('employees')
      .select('id')
      .eq('id', targetEmployeeId)
      .eq('team_id', team.id)
      .maybeSingle()
    if (!t) throw new Error('That coworker is not on this team.')
    if (targetShiftId) {
      const { data: ts } = await reader
        .from('shifts')
        .select('id, employee_id, team_id, starts_at, published')
        .eq('id', targetShiftId)
        .single()
      const tss = ts as {
        id: string
        employee_id: string | null
        team_id: string
        starts_at: string
        published: boolean
      } | null
      if (!tss || tss.team_id !== team.id || tss.employee_id !== targetEmployeeId) {
        throw new Error('That trade shift is not theirs.')
      }
      if (!tss.published || new Date(tss.starts_at).getTime() <= Date.now()) {
        throw new Error('That trade shift is not swappable.')
      }
    }
  } else {
    targetShiftId = null // open offer: no trade shift without a target
  }

  const id = await createSwapRequest({
    orgId: org.id,
    teamId: team.id,
    shiftId: input.shiftId,
    requestedBy: employeeId,
    targetEmployeeId,
    targetShiftId,
    note: input.note?.trim().slice(0, 500) || null,
  })

  await logEventAction({
    eventType: 'swap.requested',
    entityType: 'swap_request',
    entityId: id,
    metadata: {
      shift_id: input.shiftId,
      target_employee_id: targetEmployeeId,
      mutual: !!targetShiftId,
    },
  })
  return { ok: true, id }
}

export async function decideSwapAction(input: {
  id: string
  approve: boolean
  assigneeEmployeeId?: string | null
}): Promise<{ ok: true }> {
  const { user, org, manager } = await teamContext()
  if (!manager) throw new Error('Not authorized.')
  const deciderEmployeeId = await getEmployeeIdForUser(user.id, (await getActiveTeam())!.id)
  if (!deciderEmployeeId) throw new Error('You are not on this team.')

  const req = await getSwapRequest(input.id)
  if (!req) throw new Error('Swap request not found.')
  if (req.org_id !== org.id) throw new Error('Not authorized.')

  if (input.approve && input.assigneeEmployeeId) {
    const reader = await getReader()
    const { data: assignee } = await reader
      .from('employees')
      .select('id')
      .eq('id', input.assigneeEmployeeId)
      .eq('team_id', req.team_id)
      .maybeSingle()
    if (!assignee) throw new Error('The assignee is not on this team.')
  }

  await decideSwapRequest({
    id: input.id,
    approve: input.approve,
    deciderEmployeeId,
    assigneeEmployeeId: input.assigneeEmployeeId ?? null,
  })

  await logEventAction({
    eventType: input.approve ? 'swap.approved' : 'swap.declined',
    entityType: 'swap_request',
    entityId: input.id,
    metadata: { shift_id: req.shift_id },
  })
  return { ok: true }
}

export async function cancelSwapAction(id: string): Promise<{ ok: true }> {  const { team, employeeId } = await teamContext()
  if (!employeeId) throw new Error('You are not on this team.')
  const req = await getSwapRequest(id)
  if (!req || req.team_id !== team.id) throw new Error('Swap request not found.')
  if (req.requested_by !== employeeId) throw new Error('Not authorized.')
  if (req.status !== 'pending') throw new Error('Only pending requests can be cancelled.')
  await cancelSwapRequest(id, employeeId)
  await logEventAction({
    eventType: 'swap.cancelled',
    entityType: 'swap_request',
    entityId: id,
    metadata: {},
  })
  return { ok: true }
}

/** Upcoming published shifts of a coworker (for picking a trade shift). */
export async function getCoworkerShiftsAction(
  employeeId: string
): Promise<{ id: string; starts_at: string; ends_at: string }[]> {
  const { team } = await teamContext()
  const reader = await getReader()
  const { data: c } = await reader
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('team_id', team.id)
    .maybeSingle()
  if (!c) throw new Error('Not on this team.')
  return getUpcomingShiftsForEmployee(employeeId, team.id)
}
