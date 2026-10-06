// Event log — taxonomy, types, and preview-mode storage.
//
// Every meaningful user action in the app is recorded as an event via
// logEventAction (lib/event-actions.ts). Managers browse the full history
// on the /admin page. When Supabase keys are live, events persist in the
// `events` table (supabase/schema.sql). In preview mode there is no
// database, so events are kept in a process-local in-memory list —
// best-effort history for the demo, reset when the server restarts.

export const EVENT_TYPES = {
  'auth.signup': {
    label: 'Signed up',
    description: 'A new team was created (manager signed up).',
  },
  'auth.login': {
    label: 'Signed in',
    description: 'A user signed in.',
  },
  'auth.logout': {
    label: 'Signed out',
    description: 'A user signed out.',
  },
  'employee.invited': {
    label: 'Employee invited',
    description: 'A manager added a teammate to the team.',
  },
  'shift.created': {
    label: 'Shift created',
    description: 'A manager added a shift to the roster.',
  },
  'shift.updated': {
    label: 'Shift edited',
    description: 'A manager changed a shift\u2019s times.',
  },
  'shift.moved': {
    label: 'Shift moved',
    description: 'A manager dragged a shift to another day or teammate.',
  },
  'shift.deleted': {
    label: 'Shift deleted',
    description: 'A manager deleted a shift from the roster.',
  },
  'flag.toggled': {
    label: 'Feature flag toggled',
    description: 'A manager or admin changed a feature flag.',
  },
  'job.run': {
    label: 'Background job ran',
    description: 'A scheduled background job finished.',
  },
  'org.role_created': {
    label: 'Org role created',
    description: 'A manager defined a new role in the organization.',
  },
  'org.role_updated': {
    label: 'Org role updated',
    description: 'A manager changed an organization role.',
  },
  'org.member_updated': {
    label: 'Org member updated',
    description: "A manager changed a member's role or manager.",
  },
  'announcement.created': {
    label: 'Announcement posted',
    description: 'A manager posted an org-level or team-level announcement.',
  },
  'announcement.deleted': {
    label: 'Announcement deleted',
    description: 'A manager deleted an announcement.',
  },
  'swap.requested': {
    label: 'Swap requested',
    description: 'An employee requested a shift swap.',
  },
  'swap.approved': {
    label: 'Swap approved',
    description: 'A manager approved a shift swap request.',
  },
  'swap.declined': {
    label: 'Swap declined',
    description: 'A manager declined a shift swap request.',
  },
  'swap.cancelled': {
    label: 'Swap cancelled',
    description: 'An employee cancelled their pending swap request.',
  },
  'timeoff.requested': {
    label: 'Time off requested',
    description: 'An employee requested time off.',
  },
  'timeoff.approved': {
    label: 'Time off approved',
    description: 'A manager approved a time-off request.',
  },
  'timeoff.declined': {
    label: 'Time off declined',
    description: 'A manager declined a time-off request.',
  },
  'timeoff.cancelled': {
    label: 'Time off cancelled',
    description: 'An employee cancelled their pending time-off request.',
  },
  'availability.updated': {
    label: 'Availability updated',
    description: 'An employee updated their weekly availability.',
  },
} as const

export type EventType = keyof typeof EVENT_TYPES
export const ALL_EVENT_TYPES = Object.keys(EVENT_TYPES) as EventType[]

export type AppEvent = {
  id: string
  created_at: string // ISO
  team_id: string | null
  actor_id: string | null
  actor_email: string | null
  actor_role: string | null
  event_type: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
}

export type EventFilters = {
  type?: string
  q?: string // matches actor email, entity id, or metadata text
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
}

export function eventLabel(type: string): string {
  return (EVENT_TYPES as Record<string, { label: string }>)[type]?.label ?? type
}

/** Human-readable one-line summary of an event for the admin table. */
export function describeEvent(e: AppEvent): string {
  const m = e.metadata ?? {}
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  switch (e.event_type) {
    case 'auth.signup':
      return `New team${str(m.team_name) ? ` “${str(m.team_name)}”` : ''}`
    case 'auth.login':
    case 'auth.logout':
      return e.actor_email ?? 'A user'
    case 'employee.invited':
      return `${str(m.name) || 'Teammate'} <${str(m.email)}>`
    case 'shift.created':
      return `${str(m.employee_name) || 'Teammate'} • ${str(m.date)} • ${str(m.starts_at)}–${str(m.ends_at)}`
    case 'shift.updated':
      return `${str(m.employee_name) || 'Teammate'} • ${str(m.date)} • ${str(m.starts_at)}–${str(m.ends_at)}`
    case 'shift.moved':
      return `${str(m.from_employee_name) || '?'} → ${str(m.to_employee_name) || '?'} • ${str(m.to_date)}`
    case 'shift.deleted':
      return `${str(m.employee_name) || 'Teammate'} • ${str(m.date)} • ${str(m.starts_at)}–${str(m.ends_at)}`
    case 'flag.toggled':
      return `${str(m.flag_key)} → ${m.new_enabled ? 'on' : 'off'}${str(m.team_name) ? ` (${str(m.team_name)})` : ' (global)'}`
    case 'job.run':
      return `${str(m.job_key)} • ${str(m.status)}`
    case 'org.role_created':
    case 'org.role_updated':
      return `${str(m.name)} (rank ${str(m.rank)})`
    case 'org.member_updated':
      return `Member ${str(m.change)} changed`
    default:
      return e.entity_id ?? ''
  }
}

// ---- preview-mode in-memory store ----
// Module state: shared by all server-action invocations in this process.
// On serverless this is per-instance; the admin page notes the limitation.

const memoryEvents: AppEvent[] = []

export function pushMemoryEvent(e: AppEvent): void {
  memoryEvents.push(e)
  // Keep the demo store bounded.
  if (memoryEvents.length > 2000) memoryEvents.splice(0, memoryEvents.length - 2000)
}

export function getMemoryEvents(filters: EventFilters = {}): AppEvent[] {
  return filterEvents([...memoryEvents].reverse(), filters)
}

export function filterEvents(events: AppEvent[], filters: EventFilters): AppEvent[] {
  const q = (filters.q ?? '').trim().toLowerCase()
  return events.filter((e) => {
    if (filters.type && e.event_type !== filters.type) return false
    if (filters.from && e.created_at.slice(0, 10) < filters.from) return false
    if (filters.to && e.created_at.slice(0, 10) > filters.to) return false
    if (q) {
      const hay = [
        e.actor_email ?? '',
        e.event_type,
        e.entity_id ?? '',
        JSON.stringify(e.metadata ?? {}),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
