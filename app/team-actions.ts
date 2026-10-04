'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ensureOrgForTeam, addUserToTeamOrg, resolveActiveOrgId, getMyOrgs } from '@/lib/orgs'
import {
  getMyTeams,
  getActiveTeam,
  getAllMyTeamRows,
  ACTIVE_TEAM_COOKIE,
  ACTIVE_ORG_COOKIE,
  COOKIE_OPTS,
} from '@/lib/teams'

// Team-context readers live in lib/teams.ts (no @/app imports allowed there).
// Re-exported here so existing call sites keep working.
export { getMyTeams, getActiveTeam }

// Switches the active team. Validates the user actually belongs to it AND
// that it is inside the active org (getMyTeams is org-scoped, so a team id
// from another org is rejected here).
export async function setActiveTeam(teamId: string) {
  const teams = await getMyTeams()
  if (!teams.some((t) => t.id === teamId)) {
    throw new Error('You are not a member of that team.')
  }
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_TEAM_COOKIE, teamId, COOKIE_OPTS)
  return { id: teamId }
}

// Switches the active organization. Validates the user is a member of the
// org, then resets the active team to the first team inside that org (the
// previous team belongs to another org and is no longer visible).
export async function setActiveOrg(orgId: string) {
  const orgs = await getMyOrgs()
  if (!orgs.some((o) => o.id === orgId)) {
    throw new Error('You are not a member of that organization.')
  }
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, COOKIE_OPTS)
  const rows = await getAllMyTeamRows()
  const first = rows.find((r) => r.org_id === orgId)
  if (first) {
    cookieStore.set(ACTIVE_TEAM_COOKIE, first.id, COOKIE_OPTS)
  } else {
    cookieStore.delete(ACTIVE_TEAM_COOKIE)
  }
  return { id: orgId }
}

// Creates an additional team inside the user's ACTIVE organization and
// switches to it. If the user has no org context yet, falls back to the
// legacy behavior: a fresh organization is bootstrapped and they become
// its Owner.
export async function createTeam(name: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const clean = name.trim()
  if (!clean) throw new Error('Team name is required.')

  const activeOrgId = await resolveActiveOrgId()

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert(activeOrgId ? { name: clean, org_id: activeOrgId } : { name: clean })
    .select('id')
    .single()
  if (teamError) throw new Error(teamError.message)

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    'Manager'
  const { error: empError } = await supabase.from('employees').insert({
    team_id: team.id,
    user_id: user.id,
    name: displayName,
    email: user.email,
    role: 'manager',
  })
  if (empError) throw new Error(empError.message)

  // Join the org as a member. Best-effort: org bookkeeping must never
  // break team creation (the creator is already an org member anyway).
  let orgId = activeOrgId
  if (orgId) {
    try {
      await addUserToTeamOrg(team.id as string, user.id)
    } catch {
      // best-effort
    }
  } else {
    // No org context: bootstrap one and make the creator its Owner.
    try {
      orgId = await ensureOrgForTeam(team.id as string, clean, user.id)
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : 'Could not set up organization.'
      )
    }
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_TEAM_COOKIE, team.id, COOKIE_OPTS)
  if (orgId) cookieStore.set(ACTIVE_ORG_COOKIE, orgId, COOKIE_OPTS)

  return { id: team.id as string, name: clean }
}

// Creates a team and the manager's employee row for a newly signed-up user.
// Called once right after signup when the user wasn't linked to an invite.
// Also stamps team_id into the user's metadata so event logging can use it.
export async function createTeamForNewUser(teamName: string, displayName: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  // Idempotency: if this user already has an employee row, don't create a dup.
  const { data: existing } = await supabase
    .from('employees')
    .select('id, team_id')
    .eq('user_id', user.id)
    .limit(1)
  if (existing && existing.length > 0) {
    return { teamId: existing[0].team_id as string }
  }

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({ name: teamName })
    .select('id')
    .single()
  if (teamError) throw new Error(teamError.message)

  const { error: empError } = await supabase.from('employees').insert({
    team_id: team.id,
    user_id: user.id,
    name: displayName,
    email: user.email,
    role: 'manager',
  })
  if (empError) throw new Error(empError.message)

  // Every team gets its own organization; the creator becomes its Owner.
  try {
    await ensureOrgForTeam(team.id as string, teamName, user.id)
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : 'Could not set up organization.'
    )
  }

  // Stamp team_id into auth metadata for event logging + dashboard.
  await supabase.auth.updateUser({
    data: { ...user.user_metadata, team_id: team.id },
  })

  // Make it the active team.
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_TEAM_COOKIE, team.id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  return { teamId: team.id as string }
}

// Back-compat wrapper: resolves the user's active team.
export async function getMyTeam() {
  return getActiveTeam()
}

// Called after an invited employee's signup links their auth user to the
// employee row: adds them to the team's org as Employee (reporting to Owner).
// Safe to call repeatedly.
export async function linkInviteToOrg(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { data: rows } = await supabase
    .from('employees')
    .select('team_id')
    .eq('user_id', user.id)
  for (const r of (rows ?? []) as { team_id: string }[]) {
    try {
      await addUserToTeamOrg(r.team_id, user.id)
    } catch {
      // best-effort: org membership must not break signup
    }
  }
}
