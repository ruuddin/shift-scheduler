'use server'

import { logEventAction } from '@/lib/event-actions'
import { getMyTeams } from '@/app/team-actions'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  type Announcement,
} from '@/lib/announcements'
import { isFlagEnabledForTeam } from '@/lib/flags'
import { getActiveOrg, isOrgManager } from '@/lib/orgs'
import { createClient } from '@/lib/supabase/server'

async function signedIn() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return { supabase, user }
}

/** Feed data for the dashboard. Returns empty when the flag is off. */
export async function getAnnouncementsAction(): Promise<{
  announcements: Announcement[]
  canPost: boolean
  orgName: string | null
  teams: { id: string; name: string }[]
  preview: boolean
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { announcements: [], canPost: false, orgName: null, teams: [], preview: true }
  }
  const { user } = await signedIn()
  const teams = await getMyTeams()
  const activeTeam = teams[0] // any team works for the org-ceiling flag check
  const enabled = activeTeam
    ? await isFlagEnabledForTeam('announcements', activeTeam.id, user.id)
    : false
  if (!enabled) {
    return { announcements: [], canPost: false, orgName: null, teams: [], preview: false }
  }
  const org = await getActiveOrg().catch(() => null)
  const canPost = org ? await isOrgManager(user.id, org.id) : false
  const announcements = await listAnnouncements(user.id)
  return {
    announcements,
    canPost,
    orgName: org?.name ?? null,
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    preview: false,
  }
}

export async function postAnnouncementAction(input: {
  teamIds: string[]
  title: string
  body: string
}): Promise<{ ok: true }> {
  const { user } = await signedIn()
  const org = await getActiveOrg()
  if (!org) throw new Error('No organization found.')
  // Flag gate: the org ceiling applies through the active team.
  const teams = await getMyTeams()
  const activeTeam = teams.find((t) => t.id) ?? teams[0]
  if (
    activeTeam &&
    !(await isFlagEnabledForTeam('announcements', activeTeam.id, user.id))
  ) {
    throw new Error('Announcements are disabled.')
  }
  const { ids } = await createAnnouncement(user.id, user.email ?? null, {
    orgId: org.id,
    teamIds: input.teamIds,
    title: input.title,
    body: input.body,
  })
  await logEventAction({
    eventType: 'announcement.created',
    entityType: 'organization',
    entityId: org.id,
    metadata: {
      scope: input.teamIds.length > 0 ? 'team' : 'org',
      team_count: input.teamIds.length,
      title: input.title.trim().slice(0, 80),
    },
  })
  void ids
  return { ok: true }
}

export async function deleteAnnouncementAction(
  announcementId: string
): Promise<{ ok: true }> {
  const { user } = await signedIn()
  await deleteAnnouncement(user.id, announcementId)
  await logEventAction({
    eventType: 'announcement.deleted',
    entityType: 'announcement',
    entityId: announcementId,
    metadata: {},
  })
  return { ok: true }
}
