'use server'

// Manager-scoped flag actions for the customer web app. Owner-only actions
// (global defaults, history) live in app/admin/flags-actions.ts so each app
// contains only the actions its users are authorized to call.

import { getMyTeams } from '@shift-scheduler/shared/teams'
import { logEventAction } from '@shift-scheduler/shared/event-actions'
import { requireOrgManagerForActiveTeam } from '@shift-scheduler/shared/orgs'
import {
  getFlagsCatalog,
  getFlagRollout,
  isFlagEnabledForTeam,
  setFlag,
  type FlagInfo,
} from '@shift-scheduler/shared/flags'

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
