'use server'

import { logEventAction } from '@/app/event-actions'
import { getWriter } from '@/lib/db'
import { getFlagsCatalog, invalidateFlagCache, type FlagInfo } from '@/lib/flags'
import { requireOwner } from '@/lib/owner'
import type { AppEvent } from '@/lib/events'

export type ClientSummary = {
  id: string
  name: string
  created_at: string
  team_count: number
  member_count: number
}

export type ClientDetail = {
  id: string
  name: string
  created_at: string
  teams: { id: string; name: string; created_at: string; member_count: number }[]
  member_count: number
  roles: { name: string; rank: number; is_manager: boolean; member_count: number }[]
  flags: (FlagInfo & { org_enabled: boolean | null })[]
  recent_events: AppEvent[]
}

/** Owner-only: every client organization with team/member counts. */
export async function getClientsAction(): Promise<{
  clients: ClientSummary[]
  preview: boolean
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      preview: true,
      clients: [
        { id: 'demo', name: 'Demo Cafe', created_at: new Date().toISOString(), team_count: 1, member_count: 3 },
      ],
    }
  }
  await requireOwner()
  const db = await getWriter()
  const { data: orgs } = await db
    .from('organizations')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
  const { data: teams } = await db.from('teams').select('id, org_id')
  const { data: members } = await db.from('org_memberships').select('org_id')

  const teamCount = new Map<string, number>()
  for (const t of (teams ?? []) as { org_id: string }[]) {
    teamCount.set(t.org_id, (teamCount.get(t.org_id) ?? 0) + 1)
  }
  const memberCount = new Map<string, number>()
  for (const m of (members ?? []) as { org_id: string }[]) {
    memberCount.set(m.org_id, (memberCount.get(m.org_id) ?? 0) + 1)
  }
  return {
    preview: false,
    clients: ((orgs ?? []) as ClientSummary[]).map((o) => ({
      id: o.id,
      name: o.name,
      created_at: o.created_at,
      team_count: teamCount.get(o.id) ?? 0,
      member_count: memberCount.get(o.id) ?? 0,
    })),
  }
}

/** Owner-only: full detail for one client. */
export async function getClientDetailAction(
  orgId: string
): Promise<{ detail: ClientDetail; preview: boolean }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Preview mode')
  }
  await requireOwner()
  const db = await getWriter()

  const { data: org } = await db
    .from('organizations')
    .select('id, name, created_at')
    .eq('id', orgId)
    .maybeSingle()
  if (!org) throw new Error('Client not found.')

  const [{ data: teams }, { data: members }, { data: roles }, { data: orgFlags }] =
    await Promise.all([
      db.from('teams').select('id, name, created_at').eq('org_id', orgId),
      db.from('org_memberships').select('id, team_id, role_id'),
      db.from('org_roles').select('id, name, rank, is_manager').eq('org_id', orgId),
      db.from('org_feature_flags').select('flag_key, enabled').eq('org_id', orgId),
    ])

  const teamList = (teams ?? []) as { id: string; name: string; created_at: string }[]
  const memberList = (members ?? []) as { team_id: string | null; role_id: string }[]
  const roleList = (roles ?? []) as { id: string; name: string; rank: number; is_manager: boolean }[]
  const flagMap = new Map(
    ((orgFlags ?? []) as { flag_key: string; enabled: boolean }[]).map((f) => [f.flag_key, f.enabled])
  )

  // member count per team via employees table
  const { data: employees } = await db
    .from('employees')
    .select('team_id')
    .in('team_id', teamList.map((t) => t.id))
  const empCount = new Map<string, number>()
  for (const e of (employees ?? []) as { team_id: string }[]) {
    empCount.set(e.team_id, (empCount.get(e.team_id) ?? 0) + 1)
  }

  const catalog = await getFlagsCatalog()
  const teamIds = teamList.map((t) => t.id)
  const { data: events } = await db
    .from('events')
    .select('*')
    .or(
      `team_id.in.(${teamIds.length ? teamIds.join(',') : '00000000-0000-0000-0000-000000000000'}),and(entity_type.eq.organization,entity_id.eq.${orgId})`
    )
    .order('created_at', { ascending: false })
    .limit(50)

  return {
    preview: false,
    detail: {
      id: org.id,
      name: org.name,
      created_at: org.created_at,
      teams: teamList.map((t) => ({
        ...t,
        member_count: empCount.get(t.id) ?? 0,
      })),
      member_count: memberList.length,
      roles: roleList.map((r) => ({
        name: r.name,
        rank: r.rank,
        is_manager: r.is_manager,
        member_count: memberList.filter((m) => m.role_id === r.id).length,
      })),
      flags: catalog.map((f) => ({
        ...f,
        org_enabled: flagMap.has(f.flag_key) ? (flagMap.get(f.flag_key) as boolean) : null,
      })),
      recent_events: (events ?? []) as AppEvent[],
    },
  }
}

/** Owner-only: set an org-level flag ceiling for any client. */
export async function toggleClientOrgFlagAction(
  orgId: string,
  flagKey: string,
  enabled: boolean
): Promise<{ ok: true }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Preview mode')
  const { email, userId } = await requireOwner()
  const db = await getWriter()
  const { error } = await db.from('org_feature_flags').upsert(
    { org_id: orgId, flag_key: flagKey, enabled, updated_by: userId },
    { onConflict: 'org_id,flag_key' }
  )
  if (error) throw new Error('Could not save the flag.')
  invalidateFlagCache(flagKey)
  await logEventAction({
    eventType: 'flag.toggled',
    entityType: 'organization',
    entityId: orgId,
    metadata: {
      flag_key: flagKey,
      new_enabled: enabled,
      scope: 'org',
      by_owner: email,
    },
  })
  return { ok: true }
}
