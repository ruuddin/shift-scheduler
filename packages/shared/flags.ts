// Feature flags — DB-backed rollout control with 24h evaluation cache.
//
// Sources of truth, in order:
//   1. org_feature_flags for the team's org — THE ORG IS A CEILING:
//      org-disabled always wins, no matter what the team chose.
//   2. team_feature_flags row for (flag, team) → explicit per-team override
//      (a manager can only enable what the org allows)
//   3. feature_flags.default_enabled            → global default (admin-set)
//   4. FEATURE_FLAGS env var / FLAG_DEFAULTS     → fallback when the DB is
//      unreachable (preview mode, or the migration hasn't run yet)
//
// Caching (non-functional requirement):
//   - Every evaluation is cached for 24 hours, keyed by flag + team.
//   - Per-manager evaluations are cached only for managers active in the
//     last 30 days (checked against the event log). A manager who hasn't
//     acted in 30 days always reads fresh, so a stale 24h value can never
//     surprise a returning manager.
//   - Any toggle invalidates the affected cache entries immediately.
//     Org-level toggles clear the flag's entries for every team.
//
// Reader/writer split: evaluations read via getReader(), toggles write
// via getWriter().

import { getReader, getWriter } from './db'
import { getTeamOrgId, getOrgFlag } from './orgs'

export const FLAG_DEFAULTS = {
  /** Drag-and-drop moving of shifts on the roster grid */
  'dnd-scheduling': true,
  /** Create / edit / delete shifts (UI + server actions) */
  'shift-crud': true,
  /** First-run guided tour for new users */
  'guided-tour': true,
  /** Nightly maintenance banner during the test window */
  'maintenance-banner': true,
  /** Team logo and brand color on the dashboard */
  'team-branding': true,
} as const

export type FlagName = keyof typeof FLAG_DEFAULTS

export const ALL_FLAGS = Object.keys(FLAG_DEFAULTS) as FlagName[]

export type FlagInfo = {
  flag_key: string
  description: string
  default_enabled: boolean
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const ACTIVE_WINDOW_DAYS = 30

type CacheEntry = { value: boolean; expiresAt: number }
const evalCache = new Map<string, CacheEntry>()

function cacheKey(flagKey: string, teamId: string): string {
  return `${flagKey}:${teamId}`
}

export function invalidateFlagCache(flagKey: string, teamId?: string): void {
  // Org-level toggles pass no teamId: clear every team entry for the flag.
  // (Cache keys don't embed the org; clearing the whole flag is safe.)
  if (teamId) {
    evalCache.delete(cacheKey(flagKey, teamId))
    return
  }
  for (const k of evalCache.keys()) {
    if (k.startsWith(`${flagKey}:`)) evalCache.delete(k)
  }
}

// ---- env fallback (preview mode / migration not yet applied) ----

function parseEnv(): Set<string> | null {
  const raw = process.env.FEATURE_FLAGS?.trim().toLowerCase()
  if (!raw) return null
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

/** Sync env-only evaluation — kept for preview mode and old call sites. */
export function isFlagEnabled(flag: FlagName): boolean {
  const set = parseEnv()
  if (!set) return FLAG_DEFAULTS[flag]
  if (set.has('none')) return false
  if (set.has('all')) return true
  if (set.has(`no-${flag}`)) return false
  if (set.has(flag)) return true
  return FLAG_DEFAULTS[flag]
}

/** Snapshot of every flag — handy for passing to client components. */
export function getFlags(): Record<FlagName, boolean> {
  return Object.fromEntries(
    ALL_FLAGS.map((f) => [f, isFlagEnabled(f)])
  ) as Record<FlagName, boolean>
}

// ---- DB-backed evaluation ----

async function readFromDb(
  flagKey: string,
  teamId: string
): Promise<boolean | null> {
  try {
    const reader = await getReader()

    // Org ceiling: an explicit org-level "off" beats everything below it.
    const orgId = await getTeamOrgId(teamId)
    let orgSetting: boolean | null = null
    if (orgId) {
      orgSetting = await getOrgFlag(orgId, flagKey)
      if (orgSetting === false) return false
    }

    const { data: override } = await reader
      .from('team_feature_flags')
      .select('enabled')
      .eq('flag_key', flagKey)
      .eq('team_id', teamId)
      .maybeSingle()
    if (override) return override.enabled as boolean
    if (orgSetting === true) return true

    const { data: flag } = await reader
      .from('feature_flags')
      .select('default_enabled')
      .eq('flag_key', flagKey)
      .maybeSingle()
    if (flag) return flag.default_enabled as boolean
    return null
  } catch {
    return null
  }
}

/** Has this manager produced any event in the last 30 days? */
export async function isManagerActiveRecently(
  userId: string,
  teamId: string
): Promise<boolean> {
  try {
    const reader = await getReader()
    const since = new Date(
      Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()
    const { data } = await reader
      .from('events')
      .select('id')
      .eq('actor_id', userId)
      .eq('team_id', teamId)
      .gte('created_at', since)
      .limit(1)
    return !!data && data.length > 0
  } catch {
    return false
  }
}

export async function isFlagEnabledForTeam(
  flagKey: string,
  teamId: string,
  userId?: string
): Promise<boolean> {
  const key = cacheKey(flagKey, teamId)
  const cached = evalCache.get(key)

  // Managers inactive for 30+ days bypass the cache — always fresh.
  let useCache = true
  if (userId) {
    const active = await isManagerActiveRecently(userId, teamId)
    useCache = active
  }
  if (useCache && cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const fromDb = await readFromDb(flagKey, teamId)
  const value =
    fromDb ?? isFlagEnabled(flagKey as FlagName) ?? FLAG_DEFAULTS['team-branding']

  if (useCache) {
    evalCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  }
  return value
}

// ---- catalog / rollout ----

export async function getFlagsCatalog(): Promise<FlagInfo[]> {
  try {
    const reader = await getReader()
    const { data, error } = await reader
      .from('feature_flags')
      .select('flag_key, description, default_enabled')
      .order('flag_key')
    if (error || !data) throw error ?? new Error('no data')
    return data as FlagInfo[]
  } catch {
    // Fallback: env-defined flags with generic descriptions.
    return ALL_FLAGS.map((k) => ({
      flag_key: k,
      description: `Env-controlled flag (DB migration not applied yet).`,
      default_enabled: isFlagEnabled(k),
    }))
  }
}

export type FlagRollout = {
  flag_key: string
  teams_enabled: number
  teams_total: number
  users_enabled: number
}

/** How many teams / users is this flag currently enabled for? */
export async function getFlagRollout(flagKey: string): Promise<FlagRollout> {
  const empty = {
    flag_key: flagKey,
    teams_enabled: 0,
    teams_total: 0,
    users_enabled: 0,
  }
  try {
    const reader = await getReader()
    const { data: teams } = await reader.from('teams').select('id')
    const teamIds = (teams ?? []).map((t: { id: string }) => t.id)
    if (teamIds.length === 0) return empty

    const { data: flag } = await reader
      .from('feature_flags')
      .select('default_enabled')
      .eq('flag_key', flagKey)
      .maybeSingle()
    const defaultOn = (flag?.default_enabled as boolean) ?? true

    const { data: overrides } = await reader
      .from('team_feature_flags')
      .select('team_id, enabled')
      .eq('flag_key', flagKey)
    const overrideMap = new Map(
      (overrides ?? []).map((o: { team_id: string; enabled: boolean }) => [
        o.team_id,
        o.enabled,
      ])
    )

    const enabledTeams = teamIds.filter(
      (id: string) => overrideMap.get(id) ?? defaultOn
    )

    let usersEnabled = 0
    if (enabledTeams.length > 0) {
      const { count } = await reader
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .in('team_id', enabledTeams)
      usersEnabled = count ?? 0
    }

    return {
      flag_key: flagKey,
      teams_enabled: enabledTeams.length,
      teams_total: teamIds.length,
      users_enabled: usersEnabled,
    }
  } catch {
    return empty
  }
}

// ---- toggling ----

export type ToggleInput = {
  flagKey: string
  teamId: string | null // null = change the global default
  enabled: boolean
  actorId: string | null
  actorEmail: string | null
}

/** Toggle a flag for one team (manager) or globally (admin). */
export async function setFlag(input: ToggleInput): Promise<void> {
  const writer = await getWriter()

  if (input.teamId) {
    // Org ceiling: a manager can only enable what the org allows.
    if (input.enabled) {
      const orgId = await getTeamOrgId(input.teamId)
      if (orgId && (await getOrgFlag(orgId, input.flagKey)) === false) {
        throw new Error(
          'This feature is disabled for your organization — the team cannot enable it.'
        )
      }
    }

    const { data: existing } = await writer
      .from('team_feature_flags')
      .select('enabled')
      .eq('flag_key', input.flagKey)
      .eq('team_id', input.teamId)
      .maybeSingle()
    const oldEnabled = (existing?.enabled as boolean | undefined) ?? null

    const { error } = await writer.from('team_feature_flags').upsert(
      {
        flag_key: input.flagKey,
        team_id: input.teamId,
        enabled: input.enabled,
        updated_by: input.actorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'flag_key,team_id' }
    )
    if (error) throw new Error(error.message)

    await writer.from('flag_toggle_history').insert({
      flag_key: input.flagKey,
      team_id: input.teamId,
      old_enabled: oldEnabled,
      new_enabled: input.enabled,
      toggled_by: input.actorId,
      toggled_by_email: input.actorEmail,
    })
    invalidateFlagCache(input.flagKey, input.teamId)
  } else {
    const { data: existing } = await writer
      .from('feature_flags')
      .select('default_enabled')
      .eq('flag_key', input.flagKey)
      .maybeSingle()
    const oldEnabled = (existing?.default_enabled as boolean | undefined) ?? null

    const { error } = await writer
      .from('feature_flags')
      .update({ default_enabled: input.enabled })
      .eq('flag_key', input.flagKey)
    if (error) throw new Error(error.message)

    await writer.from('flag_toggle_history').insert({
      flag_key: input.flagKey,
      team_id: null,
      old_enabled: oldEnabled,
      new_enabled: input.enabled,
      toggled_by: input.actorId,
      toggled_by_email: input.actorEmail,
    })
    invalidateFlagCache(input.flagKey)
  }
}

export type ToggleRecord = {
  id: string
  flag_key: string
  team_id: string | null
  team_name: string | null
  org_id: string | null
  org_name: string | null
  old_enabled: boolean | null
  new_enabled: boolean
  toggled_by_email: string | null
  toggled_at: string
}

export async function getToggleHistory(
  flagKey?: string,
  limit = 50
): Promise<ToggleRecord[]> {
  try {
    const reader = await getReader()
    let q = reader
      .from('flag_toggle_history')
      .select(
        'id, flag_key, team_id, org_id, old_enabled, new_enabled, toggled_by_email, toggled_at'
      )
      .order('toggled_at', { ascending: false })
      .limit(limit)
    if (flagKey) q = q.eq('flag_key', flagKey)
    const { data, error } = await q
    if (error || !data) return []

    const teamIds = [...new Set(data.map((r: { team_id: string | null }) => r.team_id).filter(Boolean))]
    const orgIds = [...new Set(data.map((r: { org_id: string | null }) => r.org_id).filter(Boolean))]
    let names = new Map<string, string>()
    if (teamIds.length > 0) {
      const { data: teams } = await reader
        .from('teams')
        .select('id, name')
        .in('id', teamIds as string[])
      names = new Map(
        (teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name])
      )
    }
    let orgNames = new Map<string, string>()
    if (orgIds.length > 0) {
      const { data: orgs } = await reader
        .from('organizations')
        .select('id, name')
        .in('id', orgIds as string[])
      orgNames = new Map(
        (orgs ?? []).map((o: { id: string; name: string }) => [o.id, o.name])
      )
    }

    return data.map(
      (r: {
        id: string
        flag_key: string
        team_id: string | null
        org_id: string | null
        old_enabled: boolean | null
        new_enabled: boolean
        toggled_by_email: string | null
        toggled_at: string
      }) => ({
        ...r,
        team_name: r.team_id ? (names.get(r.team_id) ?? 'Unknown team') : null,
        org_name: r.org_id ? (orgNames.get(r.org_id) ?? 'Unknown org') : null,
      })
    )
  } catch {
    return []
  }
}

/** Managers with at least one event in the last 30 days (per team). */
export async function getRecentlyActiveManagers(
  teamId: string
): Promise<{ user_id: string; email: string | null }[]> {
  try {
    const reader = await getReader()
    const since = new Date(
      Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()
    const { data } = await reader
      .from('events')
      .select('actor_id, actor_email')
      .eq('team_id', teamId)
      .eq('actor_role', 'manager')
      .gte('created_at', since)
    const seen = new Map<string, string | null>()
    for (const e of (data ?? []) as { actor_id: string | null; actor_email: string | null }[]) {
      if (e.actor_id && !seen.has(e.actor_id)) seen.set(e.actor_id, e.actor_email)
    }
    return [...seen.entries()].map(([user_id, email]) => ({ user_id, email }))
  } catch {
    return []
  }
}
