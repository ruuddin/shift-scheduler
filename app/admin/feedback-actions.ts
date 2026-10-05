'use server'

import { requireOwner } from '@/lib/owner'
import { logEventAction } from '@/lib/event-actions'
import {
  listAllFeedback,
  setFeedbackStatus,
  type FeedbackItem,
  type FeedbackStatus,
} from '@/lib/feedback'

export async function getAdminFeedbackAction(): Promise<{
  items: FeedbackItem[]
  preview: boolean
}> {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (preview) return { items: [], preview }
  await requireOwner()
  const items = await listAllFeedback()
  return { items, preview: false }
}

export async function setFeedbackStatusAction(
  id: string,
  status: FeedbackStatus
): Promise<{ ok: true }> {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (preview) return { ok: true }
  const { userId, email } = await requireOwner()
  if (!['new', 'reviewed', 'resolved'].includes(status)) {
    throw new Error('Invalid status.')
  }
  await setFeedbackStatus(id, status, userId)
  await logEventAction({
    eventType: 'feedback.status_changed',
    entityType: 'feedback',
    entityId: id,
    metadata: { new_status: status, actor_email: email ?? null },
  })
  return { ok: true }
}
