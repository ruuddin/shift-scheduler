'use server'

import { logEventAction } from '@shift-scheduler/shared/event-actions'
import {
  createOrgRole,
  getActiveOrg,
  getOrgDetails,
  getOrgFlag,
  requireOrgManagerForActiveTeam,
  setMemberManager,
  setMemberRole,
  setOrgFlag,
  updateOrgRole,
  type OrgDetails,
  type OrgRole,
} from '@shift-scheduler/shared/orgs'
import { getFlagsCatalog, invalidateFlagCache, type FlagInfo } from '@shift-scheduler/shared/flags'

async function requireOrg() {
  const m = await requireOrgManagerForActiveTeam()
  return m
}

export async function getOrganizationAction(): Promise<{
  details: OrgDetails
  preview: boolean
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Preview mode')
  }
  const m = await requireOrg()
  const details = await getOrgDetails(m.orgId)
  if (!details) throw new Error('Organization not found.')
  return { details, preview: false }
}

export async function createRoleAction(input: {
  name: string
  rank: number
  isManager: boolean
}): Promise<OrgRole> {
  const m = await requireOrg()
  const role = await createOrgRole(m.orgId, input)
  await logEventAction({
    eventType: 'org.role_created',
    entityType: 'org_role',
    entityId: role.id,
    metadata: { org_id: m.orgId, name: role.name, rank: role.rank },
  })
  return role
}

export async function updateRoleAction(
  roleId: string,
  input: { name?: string; rank?: number; isManager?: boolean }
): Promise<OrgRole> {
  const m = await requireOrg()
  const role = await updateOrgRole(roleId, input)
  await logEventAction({
    eventType: 'org.role_updated',
    entityType: 'org_role',
    entityId: role.id,
    metadata: { org_id: m.orgId, name: role.name, rank: role.rank },
  })
  return role
}

export async function setMemberRoleAction(
  membershipId: string,
  roleId: string
): Promise<{ ok: true }> {
  const m = await requireOrg()
  await setMemberRole(membershipId, roleId)
  await logEventAction({
    eventType: 'org.member_updated',
    entityType: 'org_membership',
    entityId: membershipId,
    metadata: { org_id: m.orgId, change: 'role' },
  })
  return { ok: true }
}

export async function setMemberManagerAction(
  membershipId: string,
  managerMembershipId: string | null
): Promise<{ ok: true }> {
  const m = await requireOrg()
  await setMemberManager(membershipId, managerMembershipId)
  await logEventAction({
    eventType: 'org.member_updated',
    entityType: 'org_membership',
    entityId: membershipId,
    metadata: { org_id: m.orgId, change: 'manager' },
  })
  return { ok: true }
}

export type OrgFlagRow = FlagInfo & {
  org_enabled: boolean | null // null = not set (falls through to global default)
}

/** Org-level flags — the ceiling for every team in the org. */
export async function getOrgFlagsAction(): Promise<OrgFlagRow[]> {
  const m = await requireOrg()
  const catalog = await getFlagsCatalog()
  const rows: OrgFlagRow[] = []
  for (const f of catalog) {
    rows.push({ ...f, org_enabled: await getOrgFlag(m.orgId, f.flag_key) })
  }
  return rows
}

export async function toggleOrgFlagAction(
  flagKey: string,
  enabled: boolean
): Promise<{ ok: true }> {
  const m = await requireOrg()
  await setOrgFlag(m.orgId, flagKey, enabled, m.userId, m.email)
  invalidateFlagCache(flagKey) // clear every team under the org
  await logEventAction({
    eventType: 'flag.toggled',
    entityType: 'organization',
    entityId: m.orgId,
    metadata: { flag_key: flagKey, new_enabled: enabled, scope: 'org' },
  })
  return { ok: true }
}

/**
 * Apply the same flag state to multiple teams at once.
 * Teams whose org disabled the flag are skipped (org ceiling) and reported.
 */
export async function bulkApplyFlagsAction(
  flagKey: string,
  enabled: boolean,
  teamIds: string[]
): Promise<{ applied: string[]; skipped: string[] }> {
  const m = await requireOrg()
  const { getMyTeams } = await import('@/app/team-actions')
  const { setFlag } = await import('@shift-scheduler/shared/flags')
  const teams = await getMyTeams()
  const mine = new Set(teams.map((t) => t.id))

  const applied: string[] = []
  const skipped: string[] = []
  for (const teamId of teamIds) {
    if (!mine.has(teamId)) {
      skipped.push(teamId)
      continue
    }
    try {
      await setFlag({
        flagKey,
        teamId,
        enabled,
        actorId: m.userId,
        actorEmail: m.email,
      })
      applied.push(teamId)
    } catch {
      skipped.push(teamId)
    }
  }
  await logEventAction({
    eventType: 'flag.toggled',
    entityType: 'flag',
    entityId: flagKey,
    metadata: {
      flag_key: flagKey,
      new_enabled: enabled,
      scope: 'bulk',
      applied: applied.length,
      skipped: skipped.length,
    },
  })
  return { applied, skipped }
}

export async function getActiveOrgName(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  try {
    const org = await getActiveOrg()
    return org?.name ?? null
  } catch {
    return null
  }
}
