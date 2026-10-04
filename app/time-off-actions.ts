'use server'

import { logEventAction } from '@/app/event-actions'
import { getActiveTeam } from '@/app/team-actions'
import {
  cancelTimeOffRequest,
  createTimeOffRequest,
  decideTimeOffRequest,
  getAvailability,
  getTeamAvailability,
  getTimeOffRequest,
  listTimeOffRequests,
  setAvailability,
  type Availability,
  type TimeOffRequest,
} from '@/lib/timeoff'
import { getEmployeeIdForUser } from '@/lib/swaps'
import { isFlagEnabledForTeam } from '@/lib/flags'
import { getActiveOrg, isOrgManager } from '@/lib/orgs'
import { createClient } from '@/lib/supabase/server'
import { getReader } from '@/lib/db'

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
  const enabled = await isFlagEnabledForTeam('time-off', team.id, user.id)
  if (!enabled) throw new Error('Time off is disabled.')
  const manager = await isOrgManager(user.id, org.id)
  const employeeId = await getEmployeeIdForUser(user.id, team.id)
  return { user, team, org, manager, employeeId }
}

export type TimeOffHub = {
  requests: TimeOffRequest[]
  canManage: boolean
  myEmployeeId: string | null
  myAvailability: Availability[]
  teamAvailability: { employee_id: string; employee_name: string; days: Availability[] }[]
  enabled: boolean
  preview: boolean
}

export async function getTimeOffHubAction(): Promise<TimeOffHub> {
  const empty: TimeOffHub = {
    requests: [],
    canManage: false,
    myEmployeeId: null,
    myAvailability: [],
    teamAvailability: [],
    enabled: false,
    preview: !process.env.NEXT_PUBLIC_SUPABASE_URL,
  }
  if (empty.preview) return empty
  let ctx: Awaited<ReturnType<typeof teamContext>> | null = null
  try {
    ctx = await teamContext()
  } catch {
    return empty
  }
  const { user, team, manager, employeeId } = ctx
  const requests = await listTimeOffRequests({
    userId: user.id,
    teamId: team.id,
    isManager: manager,
  }).catch(() => [])
  const myAvailability = employeeId ? await getAvailability(employeeId).catch(() => []) : []
  const teamAvailability = manager
    ? await getTeamAvailability(team.id).catch(() => [])
    : []
  return {
    requests,
    canManage: manager,
    myEmployeeId: employeeId,
    myAvailability,
    teamAvailability,
    enabled: true,
    preview: false,
  }
}

function cleanDate(v: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Bad date.')
  return v
}

export async function requestTimeOffAction(input: {
  startsOn: string
  endsOn: string
  reason?: string
}): Promise<{ ok: true; id: string }> {
  const { team, org, employeeId } = await teamContext()
  if (!employeeId) throw new Error('You are not on this team.')
  const startsOn = cleanDate(input.startsOn)
  const endsOn = cleanDate(input.endsOn)
  if (endsOn < startsOn) throw new Error('End date is before start date.')
  const today = new Date().toISOString().slice(0, 10)
  if (endsOn < today) throw new Error('That range is entirely in the past.')

  // No overlapping pending/approved request for the same employee.
  const reader = await getReader()
  const { data: overlap } = await reader
    .from('time_off_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'approved'])
    .lte('starts_on', endsOn)
    .gte('ends_on', startsOn)
    .limit(1)
  if ((overlap?.length ?? 0) > 0) {
    throw new Error('You already have a request covering those dates.')
  }

  const id = await createTimeOffRequest({
    orgId: org.id,
    teamId: team.id,
    employeeId,
    startsOn,
    endsOn,
    reason: input.reason?.trim().slice(0, 500) || null,
  })
  await logEventAction({
    eventType: 'timeoff.requested',
    entityType: 'time_off_request',
    entityId: id,
    metadata: { starts_on: startsOn, ends_on: endsOn },
  })
  return { ok: true, id }
}

export async function decideTimeOffAction(input: {
  id: string
  approve: boolean
}): Promise<{ ok: true }> {
  const { org, manager, user, team } = await teamContext()
  if (!manager) throw new Error('Not authorized.')
  const req = await getTimeOffRequest(input.id)
  if (!req || req.team_id !== team.id) throw new Error('Request not found.')
  if (req.org_id !== org.id) throw new Error('Not authorized.')
  const deciderEmployeeId = await getEmployeeIdForUser(user.id, team.id)
  if (!deciderEmployeeId) throw new Error('You are not on this team.')
  await decideTimeOffRequest({
    id: input.id,
    approve: input.approve,
    deciderEmployeeId,
  })
  await logEventAction({
    eventType: input.approve ? 'timeoff.approved' : 'timeoff.declined',
    entityType: 'time_off_request',
    entityId: input.id,
    metadata: { starts_on: req.starts_on, ends_on: req.ends_on },
  })
  return { ok: true }
}

export async function cancelTimeOffAction(id: string): Promise<{ ok: true }> {
  const { team, employeeId } = await teamContext()
  if (!employeeId) throw new Error('You are not on this team.')
  const req = await getTimeOffRequest(id)
  if (!req || req.team_id !== team.id) throw new Error('Request not found.')
  if (req.employee_id !== employeeId) throw new Error('Not authorized.')
  if (req.status !== 'pending') throw new Error('Only pending requests can be cancelled.')
  await cancelTimeOffRequest(id, employeeId)
  await logEventAction({
    eventType: 'timeoff.cancelled',
    entityType: 'time_off_request',
    entityId: id,
    metadata: {},
  })
  return { ok: true }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export async function saveAvailabilityAction(days: Availability[]): Promise<{ ok: true }> {
  const { team, org, employeeId } = await teamContext()
  if (!employeeId) throw new Error('You are not on this team.')
  if (!Array.isArray(days) || days.length !== 7) throw new Error('Bad availability.')
  for (const d of days) {
    if (d.weekday < 0 || d.weekday > 6 || typeof d.available !== 'boolean') {
      throw new Error('Bad availability.')
    }
    for (const t of [d.unavailable_from, d.unavailable_to]) {
      if (t != null && !TIME_RE.test(t)) throw new Error('Bad time.')
    }
    if (
      d.unavailable_from &&
      d.unavailable_to &&
      d.unavailable_to <= d.unavailable_from
    ) {
      throw new Error('Unavailability window ends before it starts.')
    }
  }
  await setAvailability({ employeeId, teamId: team.id, orgId: org.id, days })
  await logEventAction({
    eventType: 'availability.updated',
    entityType: 'employee',
    entityId: employeeId,
    metadata: {},
  })
  return { ok: true }
}
