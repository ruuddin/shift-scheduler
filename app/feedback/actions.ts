'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveTeam } from '@/lib/teams'
import { getActiveOrg } from '@/lib/orgs'
import { isFlagEnabledForTeam } from '@/lib/flags'
import { logEventAction } from '@/lib/event-actions'
import {
  listMyFeedback,
  type FeedbackCategory,
  type FeedbackItem,
} from '@/lib/feedback'

async function context() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const team = await getActiveTeam()
  if (!team) throw new Error('No active team.')
  const org = await getActiveOrg()
  if (!org) throw new Error('No organization found.')
  const enabled = await isFlagEnabledForTeam('feedback', team.id, user.id)
  if (!enabled) throw new Error('Feedback is disabled.')
  return { supabase, user, team, org }
}

export type FeedbackHub = {
  items: FeedbackItem[]
  enabled: boolean
  preview: boolean
}

export async function getFeedbackHubAction(): Promise<FeedbackHub> {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (preview) return { items: [], enabled: true, preview }
  try {
    const { supabase, user, team } = await context()
    const enabled = await isFlagEnabledForTeam('feedback', team.id, user.id)
    if (!enabled) return { items: [], enabled: false, preview: false }
    const items = await listMyFeedback(supabase, user.id)
    return { items, enabled: true, preview: false }
  } catch {
    return { items: [], enabled: false, preview: false }
  }
}

export async function submitFeedbackAction(input: {
  category: FeedbackCategory
  message: string
  rating: number | null
}): Promise<{ ok: true; id: string }> {
  const { supabase, user, team, org } = await context()
  const message = input.message.trim().slice(0, 5000)
  if (!message) throw new Error('Please write your feedback.')
  if (!['bug', 'feature', 'general'].includes(input.category)) {
    throw new Error('Invalid category.')
  }
  if (input.rating !== null && (input.rating < 1 || input.rating > 5)) {
    throw new Error('Invalid rating.')
  }
  const { data, error } = await supabase
    .from('feedback')
    .insert({
      org_id: org.id,
      team_id: team.id,
      user_id: user.id,
      email: user.email ?? null,
      category: input.category,
      message,
      rating: input.rating,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not submit feedback.')
  await logEventAction({
    eventType: 'feedback.submitted',
    entityType: 'feedback',
    entityId: data.id,
    metadata: { category: input.category, team_name: team.name },
  })
  return { ok: true, id: data.id }
}
