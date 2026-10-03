'use server'

import { createClient } from '@/lib/supabase/server'

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

  // Stamp team_id into auth metadata for event logging + dashboard.
  await supabase.auth.updateUser({
    data: { ...user.user_metadata, team_id: team.id },
  })

  return { teamId: team.id as string }
}

// Resolves the current user's team via their employee row.
// Falls back to the team_id in auth metadata (set at signup).
export async function getMyTeam() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: employee } = await supabase
    .from('employees')
    .select('team_id, teams(id, name)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (employee?.team_id) {
    const teams = employee.teams as unknown as { id: string; name: string } | null
    return { id: employee.team_id as string, name: teams?.name ?? null }
  }

  const metaTeamId = user.user_metadata?.team_id as string | undefined
  if (metaTeamId) {
    const { data: team } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', metaTeamId)
      .single()
    if (team) return { id: team.id, name: team.name }
  }

  return null
}
