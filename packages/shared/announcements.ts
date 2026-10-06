import { getReader, getWriter } from './db'
import { getMyOrgs, isOrgManager } from './orgs'

export type Announcement = {
  id: string
  org_id: string
  org_name: string
  team_id: string | null
  team_name: string | null
  title: string
  body: string
  created_by_email: string | null
  created_at: string
}

/** Team ids the user belongs to (via the employees table). */
async function getMyTeamIds(
  reader: Awaited<ReturnType<typeof getReader>>,
  userId: string
): Promise<string[]> {
  const { data } = await reader
    .from('employees')
    .select('team_id')
    .eq('user_id', userId)
  return [...new Set((data ?? []).map((r) => r.team_id).filter(Boolean))]
}

/**
 * Announcements visible to the user: org-wide posts in their orgs, plus
 * team-scoped posts for their teams. Newest first.
 */
export async function listAnnouncements(
  userId: string,
  limit = 20
): Promise<Announcement[]> {
  const reader = await getReader()
  const orgs = await getMyOrgs()
  if (orgs.length === 0) return []
  const orgIds = orgs.map((o) => o.id)
  const teamIds = await getMyTeamIds(reader, userId)

  const { data } = await reader
    .from('announcements')
    .select(
      'id, org_id, team_id, title, body, created_by_email, created_at, organizations(name), teams(name)'
    )
    .in('org_id', orgIds)
    .order('created_at', { ascending: false })
    .limit(limit * 2)

  const rows = (data ?? []) as unknown as (Omit<
    Announcement,
    'org_name' | 'team_name'
  > & {
    organizations: { name: string } | null
    teams: { name: string } | null
  })[]

  return rows
    .filter((r) => r.team_id === null || teamIds.includes(r.team_id))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      org_id: r.org_id,
      org_name: r.organizations?.name ?? 'Organization',
      team_id: r.team_id,
      team_name: r.teams?.name ?? null,
      title: r.title,
      body: r.body,
      created_by_email: r.created_by_email,
      created_at: r.created_at,
    }))
}

export type NewAnnouncement = {
  orgId: string
  /** Empty = org-wide; otherwise one row per team. */
  teamIds: string[]
  title: string
  body: string
}

/**
 * Post an announcement. Caller must be an org manager in the org; team ids
 * must belong to the same org. Writes one row per team (or a single
 * org-wide row when teamIds is empty).
 */
export async function createAnnouncement(
  userId: string,
  email: string | null,
  input: NewAnnouncement
): Promise<{ ids: string[] }> {
  if (!(await isOrgManager(userId, input.orgId))) {
    throw new Error('Only managers can post announcements.')
  }
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title || !body) throw new Error('Title and body are required.')
  if (title.length > 120 || body.length > 2000) {
    throw new Error('Title (120) or body (2000) too long.')
  }

  const writer = await getWriter()
  // Guard: every team must belong to this org.
  if (input.teamIds.length > 0) {
    const { data: teams } = await writer
      .from('teams')
      .select('id')
      .eq('org_id', input.orgId)
      .in('id', input.teamIds)
    const ok = new Set((teams ?? []).map((t) => t.id))
    const bad = input.teamIds.filter((id) => !ok.has(id))
    if (bad.length > 0) throw new Error('One or more teams are not in this organization.')
  }

  const rows = (
    input.teamIds.length > 0 ? input.teamIds : [null]
  ).map((team_id) => ({
    org_id: input.orgId,
    team_id,
    title,
    body,
    created_by: userId,
    created_by_email: email,
  }))
  const { data, error } = await writer
    .from('announcements')
    .insert(rows)
    .select('id')
  if (error) throw new Error('Could not post the announcement.')
  return { ids: (data ?? []).map((r) => r.id) }
}

/** Delete an announcement. Caller must manage its org. */
export async function deleteAnnouncement(
  userId: string,
  announcementId: string
): Promise<void> {
  const reader = await getReader()
  const { data: row } = await reader
    .from('announcements')
    .select('org_id')
    .eq('id', announcementId)
    .maybeSingle()
  if (!row) throw new Error('Announcement not found.')
  if (!(await isOrgManager(userId, row.org_id))) {
    throw new Error('Only managers can delete announcements.')
  }
  const writer = await getWriter()
  const { error } = await writer
    .from('announcements')
    .delete()
    .eq('id', announcementId)
  if (error) throw new Error('Could not delete the announcement.')
}
