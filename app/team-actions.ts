'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { ensureOrgForTeam, addUserToTeamOrg } from '@/lib/orgs'

const ACTIVE_TEAM_COOKIE = 'active_team_id'

// Lists every team the current user belongs to (via their employee rows).
export async function getMyTeams() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: rows } = await supabase
    .from('employees')
    .select('team_id, role, teams(id, name)')
    .eq('user_id', user.id)

  const teams = (rows ?? [])
    .filter((r) => r.team_id)
    .map((r) => {
      const t = r.teams as unknown as { id: string; name: string } | null
      return {
        id: r.team_id as string,
        name: t?.name ?? 'Unnamed team',
        role: (r.role as string) ?? 'employee',
      }
    })

  // De-dupe by team id (a user should only have one row per team, but be safe).
  const seen = new Set<string>()
  return teams.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
}

// The team the user is currently working in. Reads the active_team_id cookie,
// falls back to their first team. Returns null when the user has no team.
export async function getActiveTeam() {
  const teams = await getMyTeams()
  if (teams.length === 0) return null

  const cookieStore = await cookies()
  const activeId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value
  const match = activeId ? teams.find((t) => t.id === activeId) : undefined
  return match ?? teams[0] ?? null
}

// Switches the active team. Validates the user actually belongs to it.
export async function setActiveTeam(teamId: string) {
  const teams = await getMyTeams()
  if (!teams.some((t) => t.id === teamId)) {
    throw new Error('You are not a member of that team.')
  }
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_TEAM_COOKIE, teamId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })
  return { id: teamId }
}

// Creates an additional team for the logged-in user (they become its manager)
// and switches to it.
export async function createTeam(name: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const clean = name.trim()
  if (!clean) throw new Error('Team name is required.')

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({ name: clean })
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

  // Every team gets its own organization; the creator becomes its Owner.
  try {
    await ensureOrgForTeam(team.id as string, clean, user.id)
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : 'Could not set up organization.'
    )
  }

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_TEAM_COOKIE, team.id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

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
