// Organizations — orgs, org-defined roles, memberships, reporting lines.
//
// Model:
//   - Every team belongs to exactly one org (teams.org_id).
//   - Each org defines its own roles: name, rank (higher = more senior),
//     is_manager (grants manager permissions).
//   - Every membership has a REQUIRED role and AT MOST ONE manager
//     (manager_membership_id). The DB trigger enforces the hierarchy:
//     manager must be in the same org with a STRICTLY higher rank —
//     same rank can't manage same rank, lower can't manage higher —
//     and reporting chains can't cycle.
//   - "One manager" is per-org: a user in many orgs has one manager per org.
//
// Reads go through getReader(), writes through getWriter().

import { createClient } from './supabase/server'
import { getActiveTeam, ACTIVE_ORG_COOKIE } from './teams'
import { getReader, getWriter } from './db'
import { cookies } from 'next/headers'
import { cache } from 'react'

export type Org = {
  id: string
  name: string
  created_at: string
}

export type OrgRole = {
  id: string
  org_id: string
  name: string
  rank: number
  is_manager: boolean
}

export type OrgMember = {
  id: string
  org_id: string
  user_id: string
  role_id: string
  manager_membership_id: string | null
  created_at: string
  role: OrgRole
  manager_email: string | null
  email: string | null
}

function isPreview(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
}

export const getTeamOrgId = cache(
  async (teamId: string): Promise<string | null> => {
    if (isPreview()) return null
    try {
      const reader = await getReader()
      const { data } = await reader
        .from('teams')
        .select('org_id')
        .eq('id', teamId)
        .maybeSingle()
      return (data?.org_id as string | null) ?? null
    } catch {
      return null
    }
  }
)

export const getActiveOrg = cache(async (): Promise<Org | null> => {
  // Org-first context: the active_org_id cookie wins when it names an org
  // the user belongs to. Falls back to the active team's org, then the
  // first org — so existing sessions keep working.
  const orgId = await resolveActiveOrgId()
  if (orgId) {
    try {
      const reader = await getReader()
      const { data } = await reader
        .from('organizations')
        .select('id, name, created_at')
        .eq('id', orgId)
        .maybeSingle()
      if (data) return data as Org
    } catch {
      // fall through to team-derived org
    }
  }
  const team = await getActiveTeam()
  if (!team) return null
  const teamOrgId = await getTeamOrgId(team.id)
  if (!teamOrgId) return null
  try {
    const reader = await getReader()
    const { data } = await reader
      .from('organizations')
      .select('id, name, created_at')
      .eq('id', teamOrgId)
      .maybeSingle()
    return (data as Org | null) ?? null
  } catch {
    return null
  }
})

/**
 * The org id for the current request's org context. Cookie-first, validated
 * against membership, falling back to the user's first org. Deliberately
 * does NOT consult the active team (getMyTeams depends on this — going
 * through getActiveTeam here would recurse).
 *
 * Memoized per request: getMyTeams(), getActiveOrg() and several pages all
 * funnel through here; without dedup the org_memberships table is queried
 * 3+ times per render.
 */
export const resolveActiveOrgId = cache(
  async (): Promise<string | null> => {
    if (isPreview()) return null
    try {
      const orgs = await getMyOrgs()
      if (orgs.length === 0) return null
      const cookieStore = await cookies()
      const id = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
      if (id && orgs.some((o) => o.id === id)) return id
      return orgs[0]?.id ?? null
    } catch {
      return null
    }
  }
)

export const getMyOrgs = cache(async (): Promise<Org[]> => {
  if (isPreview()) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  try {
    const reader = await getReader()
    const { data } = await reader
      .from('org_memberships')
      .select('org_id, organizations(id, name, created_at)')
      .eq('user_id', user.id)
    return ((data ?? []) as unknown as { organizations: Org }[]).map(
      (r) => r.organizations
    )
  } catch {
    return []
  }
})

/** True when the user's org role grants manager permissions. */
export async function isOrgManager(
  userId: string,
  orgId: string
): Promise<boolean> {
  if (isPreview()) return true
  try {
    const reader = await getReader()
    const { data } = await reader
      .from('org_memberships')
      .select('id, org_roles!inner(is_manager)')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()
    const roles = (data as { org_roles: { is_manager: boolean } } | null)
      ?.org_roles
    return !!roles?.is_manager
  } catch {
    return false
  }
}

/**
 * The permission gate that replaces every `role === 'manager'` check:
 * the signed-in user must hold a manager-granting role in the active
 * team's organization.
 */
export async function requireOrgManagerForActiveTeam(): Promise<{
  userId: string
  email: string | null
  teamId: string
  teamName: string
  orgId: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const activeTeam = await getActiveTeam()
  if (!activeTeam) throw new Error('No active team')
  const orgId = await getTeamOrgId(activeTeam.id)
  if (!orgId) throw new Error('Team has no organization')
  const ok = await isOrgManager(user.id, orgId)
  if (!ok) throw new Error('Not authorized')
  return {
    userId: user.id,
    email: user.email ?? null,
    teamId: activeTeam.id,
    teamName: activeTeam.name,
    orgId,
  }
}

export type OrgDetails = {
  org: Org
  roles: OrgRole[]
  members: OrgMember[]
}

/** Full org picture for the manager UI: roles + members + reporting lines. */
export async function getOrgDetails(orgId: string): Promise<OrgDetails | null> {
  if (isPreview()) return null
  try {
    const reader = await getReader()
    const { data: org } = await reader
      .from('organizations')
      .select('id, name, created_at')
      .eq('id', orgId)
      .maybeSingle()
    if (!org) return null

    const { data: roles } = await reader
      .from('org_roles')
      .select('id, org_id, name, rank, is_manager')
      .eq('org_id', orgId)
      .order('rank', { ascending: false })

    const { data: members } = await reader
      .from('org_memberships')
      .select(
        'id, org_id, user_id, role_id, manager_membership_id, created_at, org_roles(id, org_id, name, rank, is_manager)'
      )
      .eq('org_id', orgId)

    // Resolve emails + manager emails from the employees table.
    const userIds = [...new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id))]
    let emailByUser = new Map<string, string>()
    let memberIdByUser = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: emps } = await reader
        .from('employees')
        .select('user_id, email')
        .in('user_id', userIds)
      emailByUser = new Map(
        ((emps ?? []) as { user_id: string; email: string }[]).map((e) => [
          e.user_id,
          e.email,
        ])
      )
      memberIdByUser = new Map(
        ((members ?? []) as { id: string; user_id: string }[]).map((m) => [
          m.user_id,
          m.id,
        ])
      )
    }
    const emailByMember = new Map<string, string>()
    for (const [uid, mid] of memberIdByUser) {
      const em = emailByUser.get(uid)
      if (em) emailByMember.set(mid, em)
    }

    const list = ((members ?? []) as unknown as (Omit<OrgMember, 'role' | 'manager_email' | 'email'> & {
      org_roles: OrgRole
    })[]).map((m) => ({
      id: m.id,
      org_id: m.org_id,
      user_id: m.user_id,
      role_id: m.role_id,
      manager_membership_id: m.manager_membership_id,
      created_at: m.created_at,
      role: m.org_roles,
      email: emailByUser.get(m.user_id) ?? null,
      manager_email: m.manager_membership_id
        ? (emailByMember.get(m.manager_membership_id) ?? null)
        : null,
    }))

    return {
      org: org as Org,
      roles: (roles ?? []) as OrgRole[],
      members: list,
    }
  } catch {
    return null
  }
}

// ---- org bootstrap (team creation / invite linking) ----

/** Create the org for a new team (seed roles + owner). Idempotent. */
export async function ensureOrgForTeam(
  teamId: string,
  teamName: string,
  ownerUserId: string
): Promise<string> {
  const writer = await getWriter()
  const { data, error } = await writer.rpc('bootstrap_org', {
    p_team_id: teamId,
    p_org_name: teamName,
    p_owner: ownerUserId,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/** Add a newly-linked user to the team's org as Employee. */
export async function addUserToTeamOrg(
  teamId: string,
  userId: string
): Promise<void> {
  const orgId = await getTeamOrgId(teamId)
  if (!orgId) return
  const writer = await getWriter()
  const { error } = await writer.rpc('add_org_member', {
    p_org_id: orgId,
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}

// ---- roles & members management (manager-only, app layer) ----

async function assertCanManageOrg(orgId: string): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  if (!(await isOrgManager(user.id, orgId))) throw new Error('Not authorized')
  return user.id
}

function cleanRoleName(name: string): string {
  const n = name.trim().slice(0, 40)
  if (!n) throw new Error('Role name is required.')
  return n
}

export async function createOrgRole(
  orgId: string,
  input: { name: string; rank: number; isManager: boolean }
): Promise<OrgRole> {
  await assertCanManageOrg(orgId)
  const rank = Math.floor(Number(input.rank))
  if (!Number.isFinite(rank) || rank < 1 || rank > 1000) {
    throw new Error('Rank must be a number between 1 and 1000.')
  }
  const writer = await getWriter()
  const { data, error } = await writer
    .from('org_roles')
    .insert({
      org_id: orgId,
      name: cleanRoleName(input.name),
      rank,
      is_manager: !!input.isManager,
    })
    .select('id, org_id, name, rank, is_manager')
    .single()
  if (error) throw new Error(error.message)
  return data as OrgRole
}

export async function updateOrgRole(
  roleId: string,
  input: { name?: string; rank?: number; isManager?: boolean }
): Promise<OrgRole> {
  const reader = await getReader()
  const { data: role } = await reader
    .from('org_roles')
    .select('org_id')
    .eq('id', roleId)
    .maybeSingle()
  if (!role) throw new Error('Role not found.')
  await assertCanManageOrg((role as { org_id: string }).org_id)

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = cleanRoleName(input.name)
  if (input.rank !== undefined) {
    const rank = Math.floor(Number(input.rank))
    if (!Number.isFinite(rank) || rank < 1 || rank > 1000) {
      throw new Error('Rank must be a number between 1 and 1000.')
    }
    patch.rank = rank
  }
  if (input.isManager !== undefined) patch.is_manager = !!input.isManager

  const writer = await getWriter()
  const { data, error } = await writer
    .from('org_roles')
    .update(patch)
    .eq('id', roleId)
    .select('id, org_id, name, rank, is_manager')
    .single()
  if (error) throw new Error(error.message)
  return data as OrgRole
}

export async function setMemberRole(
  membershipId: string,
  roleId: string
): Promise<void> {
  const reader = await getReader()
  const { data: mem } = await reader
    .from('org_memberships')
    .select('org_id')
    .eq('id', membershipId)
    .maybeSingle()
  if (!mem) throw new Error('Member not found.')
  const orgId = (mem as { org_id: string }).org_id
  await assertCanManageOrg(orgId)

  const writer = await getWriter()
  const { error } = await writer
    .from('org_memberships')
    .update({ role_id: roleId })
    .eq('id', membershipId)
  if (error) throw new Error(error.message)
}

/** Assign (or clear) a member's one manager. DB trigger enforces hierarchy. */
export async function setMemberManager(
  membershipId: string,
  managerMembershipId: string | null
): Promise<void> {
  const reader = await getReader()
  const { data: mem } = await reader
    .from('org_memberships')
    .select('org_id')
    .eq('id', membershipId)
    .maybeSingle()
  if (!mem) throw new Error('Member not found.')
  const orgId = (mem as { org_id: string }).org_id
  await assertCanManageOrg(orgId)

  if (managerMembershipId) {
    const { data: mgr } = await reader
      .from('org_memberships')
      .select('org_id')
      .eq('id', managerMembershipId)
      .maybeSingle()
    if (!mgr || (mgr as { org_id: string }).org_id !== orgId) {
      throw new Error('Manager must belong to the same organization.')
    }
  }

  const writer = await getWriter()
  const { error } = await writer
    .from('org_memberships')
    .update({ manager_membership_id: managerMembershipId })
    .eq('id', membershipId)
  if (error) throw new Error(error.message)
}

// ---- org-level feature flags (the org is a ceiling) ----

/** Explicit org-level setting, or null when the org hasn't chosen. */
export async function getOrgFlag(
  orgId: string,
  flagKey: string
): Promise<boolean | null> {
  if (isPreview()) return null
  try {
    const reader = await getReader()
    const { data } = await reader
      .from('org_feature_flags')
      .select('enabled')
      .eq('org_id', orgId)
      .eq('flag_key', flagKey)
      .maybeSingle()
    return (data?.enabled as boolean | undefined) ?? null
  } catch {
    return null
  }
}

export async function setOrgFlag(
  orgId: string,
  flagKey: string,
  enabled: boolean,
  actorId: string | null,
  actorEmail: string | null
): Promise<void> {
  await assertCanManageOrg(orgId)
  const writer = await getWriter()

  const { data: existing } = await writer
    .from('org_feature_flags')
    .select('enabled')
    .eq('org_id', orgId)
    .eq('flag_key', flagKey)
    .maybeSingle()
  const oldEnabled = (existing?.enabled as boolean | undefined) ?? null

  const { error } = await writer.from('org_feature_flags').upsert(
    {
      org_id: orgId,
      flag_key: flagKey,
      enabled,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,flag_key' }
  )
  if (error) throw new Error(error.message)

  await writer.from('flag_toggle_history').insert({
    flag_key: flagKey,
    org_id: orgId,
    team_id: null,
    old_enabled: oldEnabled,
    new_enabled: enabled,
    toggled_by: actorId,
    toggled_by_email: actorEmail,
  })
}
