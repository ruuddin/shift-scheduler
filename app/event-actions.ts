'use server'

import { createClient } from '@/lib/supabase/server'
import {
  AppEvent,
  EventFilters,
  filterEvents,
  getMemoryEvents,
  pushMemoryEvent,
} from '@/lib/events'

function isPreview(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
}

type LogInput = {
  eventType: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  /** For pre-auth events (signup) where no session exists yet. */
  actorEmail?: string
  actorRole?: string
  teamName?: string
}

/**
 * Record a user action in the event log. Safe to call from any client or
 * server component. Never throws — logging must not break the action it
 * describes.
 */
export async function logEventAction(input: LogInput): Promise<void> {
  try {
    const now = new Date().toISOString()
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    if (isPreview()) {
      pushMemoryEvent({
        id,
        created_at: now,
        team_id: null,
        actor_id: null,
        actor_email: input.actorEmail ?? 'manager@demo.cafe',
        actor_role: input.actorRole ?? 'manager',
        event_type: input.eventType,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? {},
      })
      return
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Resolve team_id from the employee row first, then auth metadata.
    let teamId: string | null =
      (user?.user_metadata?.team_id as string | undefined) ?? null
    if (!teamId && user) {
      const { data: employee } = await supabase
        .from('employees')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      teamId = (employee?.team_id as string | undefined) ?? null
    }

    const { error } = await supabase.from('events').insert({
      team_id: teamId,
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? input.actorEmail ?? null,
      actor_role:
        (user?.user_metadata?.role as string | undefined) ??
        input.actorRole ??
        null,
      event_type: input.eventType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.teamName ? { team_name: input.teamName } : {}),
      },
    })
    if (error) console.error('logEventAction: insert failed', error.message)
  } catch (err) {
    console.error('logEventAction: unexpected error', err)
  }
}

/**
 * Read the event history for the admin page. Manager-only.
 * Returns newest-first. In preview mode reads the in-memory store.
 */
export async function getEventsAction(
  filters: EventFilters = {}
): Promise<{ events: AppEvent[]; preview: boolean }> {
  const preview = isPreview()
  if (preview) {
    return { events: getMemoryEvents(filters), preview }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authorized')
  const { getActiveTeam, getMyTeams } = await import('@/app/team-actions')
  const activeTeam = await getActiveTeam()
  const teams = await getMyTeams()
  const role = teams.find((t) => t.id === activeTeam?.id)?.role
  if (role !== 'manager' || !activeTeam) {
    throw new Error('Not authorized')
  }
  const teamId = activeTeam.id

  let query = supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (teamId) query = query.eq('team_id', teamId)
  if (filters.type) query = query.eq('event_type', filters.type)
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00Z`)
  if (filters.to) query = query.lt('created_at', `${filters.to}T00:00:00Z`)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  const events = filterEvents((data ?? []) as AppEvent[], { q: filters.q })
  return { events, preview }
}
