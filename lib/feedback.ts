import { getReader, getWriter } from './db'

export type FeedbackCategory = 'bug' | 'feature' | 'general'
export type FeedbackStatus = 'new' | 'reviewed' | 'resolved'

export type FeedbackItem = {
  id: string
  org_id: string
  org_name: string | null
  team_id: string | null
  user_id: string
  email: string | null
  category: FeedbackCategory
  message: string
  rating: number | null
  status: FeedbackStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

type FeedbackRow = {
  id: string
  org_id: string
  team_id: string | null
  user_id: string
  email: string | null
  category: FeedbackCategory
  message: string
  rating: number | null
  status: FeedbackStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  organizations?: { name: string } | { name: string }[] | null
}

function toItem(row: FeedbackRow): FeedbackItem {
  const org = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations
  return {
    id: row.id,
    org_id: row.org_id,
    org_name: org?.name ?? null,
    team_id: row.team_id,
    user_id: row.user_id,
    email: row.email,
    category: row.category,
    message: row.message,
    rating: row.rating,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
  }
}

/** A user's own submissions (RLS: own rows). Uses the user's client. */
export async function listMyFeedback(
  supabase: Awaited<ReturnType<typeof getReader>>,
  userId: string
): Promise<FeedbackItem[]> {
  const { data } = await supabase
    .from('feedback')
    .select('*, organizations(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return ((data ?? []) as FeedbackRow[]).map(toItem)
}

/** Every feedback row in an org (managers). */
export async function listOrgFeedback(orgId: string): Promise<FeedbackItem[]> {
  const reader = await getReader()
  const { data } = await reader
    .from('feedback')
    .select('*, organizations(name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)
  return ((data ?? []) as FeedbackRow[]).map(toItem)
}

/**
 * All feedback across every client (owner console). Uses the writer because
 * RLS scopes reads to one org; the owner gate is enforced by requireOwner()
 * in the calling action.
 */
export async function listAllFeedback(): Promise<FeedbackItem[]> {
  const writer = await getWriter()
  const { data } = await writer
    .from('feedback')
    .select('*, organizations(name)')
    .order('created_at', { ascending: false })
    .limit(500)
  return ((data ?? []) as FeedbackRow[]).map(toItem)
}

export async function setFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  reviewedBy: string | null
): Promise<void> {
  const writer = await getWriter()
  const { error } = await writer
    .from('feedback')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
