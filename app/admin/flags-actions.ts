'use server'

// Owner-only flag administration. Lives under app/admin so the admin app
// owns it outright in the service split (docs/SERVICE-SPLIT-PLAN.md).
// The manager-scoped actions stay in app/flags-actions.ts for the web app.

import { createClient } from '@/lib/supabase/server'
import { logEventAction } from '@/lib/event-actions'
import { requireOwner } from '@/lib/owner'
import {
  getFlagsCatalog,
  getFlagRollout,
  getToggleHistory,
  setFlag,
  type FlagInfo,
  type FlagRollout,
  type ToggleRecord,
} from '@/lib/flags'

function isPreview(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
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
