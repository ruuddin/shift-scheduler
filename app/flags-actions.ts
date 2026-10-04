'use server'

import { createClient } from '@/lib/supabase/server'
import { getMyTeams } from '@/app/team-actions'
import { logEventAction } from '@/app/event-actions'
import { requireOrgManagerForActiveTeam } from '@/lib/orgs'
import { requireOwner } from '@/lib/owner'
import {
  getFlagsCatalog,
  getFlagRollout,
  getToggleHistory,
  isFlagEnabledForTeam,
  setFlag,
  type FlagInfo,
  type FlagRollout,
  type ToggleRecord,
} from '@/lib/flags'

function isPreview(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
}

async function requireManager() {
  // Manager = holds a manager-granting role in the active team's org.
  const m = await requireOrgManagerForActiveTeam()
  const teams = await getMyTeams()
  return {
    user: { id: m.userId, email: m.email },
    activeTeam: { id: m.teamId, name: m.teamName },
    orgId: m.orgId,
    teams,
  }
}

export type ManagerFlagRow = FlagInfo & {
  enabled_for_team: boolean
  teams_enabled: number
  teams_total: number
  users_enabled: number
}

/** Manager view: every flag + its state for the manager's active team. */
export async function getManagerFlags(): Promise<{
  teamName: string
  teamId: string
  teams: { id: string; name: string }[]
  flags: ManagerFlagRow[]
  preview: boolean
}> {
  if (isPreview()) {
    const catalog = await getFlagsCatalog()
    return {
      teamName: 'Demo Cafe',
      teamId: 'demo',
      teams: [{ id: 'demo', name: 'Demo Cafe' }],
      preview: true,
      flags: catalog.map((f) => ({
        ...f,
        enabled_for_team: f.default_enabled,
        teams_enabled: 1,
        teams_total: 1,
        users_enabled: 3,
      })),
    }
  }
  const { user, activeTeam, teams } = await requireManager()
  const catalog = await getFlagsCatalog()
  const flags: ManagerFlagRow[] = []
  for (const f of catalog) {
    const [enabled, rollout] = await Promise.all([
      isFlagEnabledForTeam(f.flag_key, activeTeam.id, user.id),
      getFlagRollout(f.flag_key),
    ])
    flags.push({ ...f, enabled_for_team: enabled, ...rollout })
  }
  return {
    teamName: activeTeam.name,
    teamId: activeTeam.id,
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    flags,
    preview: false,
  }
}

/** Manager toggles a flag for their active team only. */
export async function toggleTeamFlag(
  flagKey: string,
  enabled: boolean
): Promise<{ ok: true }> {
  const { user, activeTeam } = await requireManager()
  await setFlag({
    flagKey,
    teamId: activeTeam.id,
    enabled,
    actorId: user.id,
    actorEmail: user.email ?? null,
  })
  await logEventAction({
    eventType: 'flag.toggled',
    entityType: 'team',
    entityId: activeTeam.id,
    metadata: {
      flag_key: flagKey,
      new_enabled: enabled,
      team_name: activeTeam.name,
      scope: 'team',
    },
  })
  return { ok: true }
}

export type AdminFlagRow = FlagInfo &
  FlagRollout & {
    team_overrides: { team_id: string; team_name: string; enabled: boolean }[]
  }

/** Admin view: catalog + global defaults + rollout + per-team overrides. */
export async function getAdminFlags(): Promise<{
  flags: AdminFlagRow[]
  preview: boolean
}> {
  if (isPreview()) {
    const catalog = await getFlagsCatalog()
    return {
      preview: true,
      flags: catalog.map((f) => ({
        ...f,
        teams_enabled: 1,
        teams_total: 1,
        users_enabled: 3,
        team_overrides: [],
      })),
    }
  }
  await requireOwner()
  const supabase = await createClient()
  const catalog = await getFlagsCatalog()

  // Owner sees every team across all clients.
  const { data: myTeams } = await supabase.from('teams').select('id, name')
  const teamList = (myTeams ?? []) as { id: string; name: string }[]
  const teamIds = teamList.map((t) => t.id)
  const { data: overrides } = teamIds.length
    ? await supabase
        .from('team_feature_flags')
        .select('flag_key, team_id, enabled')
        .in('team_id', teamIds)
    : { data: [] as { flag_key: string; team_id: string; enabled: boolean }[] }
  const overrideRows = (overrides ?? []) as {
    flag_key: string
    team_id: string
    enabled: boolean
  }[]

  const flags: AdminFlagRow[] = []
  for (const f of catalog) {
    const rollout = await getFlagRollout(f.flag_key)
    flags.push({
      ...f,
      ...rollout,
      team_overrides: overrideRows
        .filter((o) => o.flag_key === f.flag_key)
        .map((o) => ({
          team_id: o.team_id,
          team_name: teamList.find((t) => t.id === o.team_id)?.name ?? 'Unknown team',
          enabled: o.enabled,
        })),
    })
  }
  return { flags, preview: false }
}

/** Admin changes the global default for a flag (affects all teams). */
export async function toggleGlobalFlag(
  flagKey: string,
  enabled: boolean
): Promise<{ ok: true }> {
  const { userId, email } = await requireOwner()
  await setFlag({
    flagKey,
    teamId: null,
    enabled,
    actorId: userId,
    actorEmail: email ?? null,
  })
  await logEventAction({
    eventType: 'flag.toggled',
    entityType: 'flag',
    entityId: flagKey,
    metadata: { flag_key: flagKey, new_enabled: enabled, scope: 'global' },
  })
  return { ok: true }
}

export async function getFlagHistoryAction(
  flagKey?: string
): Promise<ToggleRecord[]> {
  if (isPreview()) return []
  await requireOwner()
  return getToggleHistory(flagKey, 50)
}
