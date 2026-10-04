// Team context — which teams the user sees and which one is active.
//
// This module is importable from anywhere, including other lib modules: it
// never imports from `@/app/*` (that direction caused the cycle that blocked
// the service split — see docs/SERVICE-SPLIT-PLAN.md). Server actions that
// mutate context (setActiveTeam, setActiveOrg, createTeam) stay in
// `app/team-actions.ts`, which re-exports the readers below.
//
// Note: lib/teams.ts and lib/orgs.ts reference each other, but only inside
// async function bodies (never at module init), so the cycle is safe.

import { cookies } from 'next/headers'
import { createClient } from './supabase/server'
import { resolveActiveOrgId } from './orgs'

export const ACTIVE_TEAM_COOKIE = 'active_team_id'
export const ACTIVE_ORG_COOKIE = 'active_org_id'
export const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: 'lax' as const,
}

export type TeamRow = {
  id: string
  name: string
  role: string
  org_id: string | null
}

// Every team the current user belongs to, across ALL orgs (via their
// employee rows). Internal — callers must use getMyTeams(), which scopes
// to the active org.
export async function getAllMyTeamRows(): Promise<TeamRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: rows } = await supabase
    .from('employees')
    .select('team_id, role, teams(id, name, org_id)')
    .eq('user_id', user.id)

  const teams = (rows ?? [])
    .filter((r) => r.team_id)
    .map((r) => {
      const t = r.teams as unknown as {
        id: string
        name: string
        org_id: string | null
      } | null
      return {
        id: r.team_id as string,
        name: t?.name ?? 'Unnamed team',
        role: (r.role as string) ?? 'employee',
        org_id: t?.org_id ?? null,
      }
    })

  // De-dupe by team id (a user should only have one row per team, but be safe).
  const seen = new Set<string>()
  return teams.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
}

// Teams the user can see in the current org context. A user in several
// orgs only ever sees the active org's teams — never teams from other orgs.
// Falls back to all teams only when the user has no org context at all.
export async function getMyTeams() {
  const orgId = await resolveActiveOrgId()
  const rows = await getAllMyTeamRows()
  const visible = orgId ? rows.filter((r) => r.org_id === orgId) : rows
  return visible.map(({ id, name, role }) => ({ id, name, role }))
}

// The team the user is currently working in, within the active org.
// Reads the active_team_id cookie, falls back to their first team in the
// org. Returns null when the user has no team in the org.
export async function getActiveTeam() {
  const teams = await getMyTeams()
  if (teams.length === 0) return null

  const cookieStore = await cookies()
  const activeId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value
  const match = activeId ? teams.find((t) => t.id === activeId) : undefined
  return match ?? teams[0] ?? null
}
