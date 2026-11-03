// WebMCP tool: get_roster_week — one read-only tool exposing the roster.
//
// Design (see docs/WEBMCP.md, following Chrome's WebMCP safety guide):
// - Read-only: annotations.readOnlyHint = true; the tool never writes.
// - Same scope as the /roster page: the server route requires a signed-in
//   manager of the active team, so an agent sees exactly what the roster
//   page shows — never another team, never a non-manager's view.
// - Minimal output: names + roles + shift times only. No emails, no row
//   IDs (the app never exposes enumerable IDs), no shift notes.
// - untrustedContentHint = true: roster entries are manager-entered text,
//   i.e. user-generated content an agent must treat as data, not orders.
// - No exposedTo: the tool stays available to the page's own agent context
//   only (the conservative default); cross-origin exposure would need an
//   explicit trust decision.
// - Feature-detected: on browsers without WebMCP this module is inert —
//   the app works exactly as before.
//
// This file is client-importable: it must stay free of server-only imports
// (the data fetch goes through the /api/webmcp/roster route).

export type RosterToolInput = {
  week?: string
}

type ToolResult = {
  content: { type: 'text'; text: string }[]
}

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/

// Chrome recommends ~500 characters per tool description.
const DESCRIPTION =
  "Returns the signed-in manager's active team roster for one week: team members and their shifts (day, start time, end time, published status). Use when asked who is working, what a teammate's shifts are, or what the roster looks like for a week. Read-only; only the caller's own team is ever returned."

type RosterApiMember = {
  name: string
  role: string
  shifts: { day: string; start: string; end: string; published: boolean }[]
}

type RosterApiResponse = {
  week_start: string
  week_end: string
  team_name: string | null
  shift_count: number
  truncated: boolean
  members: RosterApiMember[]
}

function formatRoster(data: RosterApiResponse): string {
  const lines: string[] = []
  lines.push(
    `Roster for ${data.team_name ?? 'the active team'}, week of ${data.week_start} to ${data.week_end} (${data.shift_count} shift${data.shift_count === 1 ? '' : 's'}${data.truncated ? ', showing the first 200' : ''}):`
  )
  for (const m of data.members) {
    if (m.shifts.length === 0) {
      lines.push(`- ${m.name} (${m.role}): no shifts this week`)
    } else {
      const shifts = m.shifts
        .map(
          (s) =>
            `${s.day} ${s.start}-${s.end}${s.published ? '' : ' (unpublished)'}`
        )
        .join(', ')
      lines.push(`- ${m.name} (${m.role}): ${shifts}`)
    }
  }
  return lines.join('\n')
}

async function executeRosterTool(input: RosterToolInput): Promise<ToolResult> {
  const week = input.week?.trim()
  if (week && !WEEK_RE.test(week)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Invalid week: pass a Monday date as YYYY-MM-DD, or leave week out for the current week.',
        },
      ],
    }
  }
  let res: Response
  try {
    res = await fetch(
      `/api/webmcp/roster${week ? `?week=${encodeURIComponent(week)}` : ''}`,
      { credentials: 'same-origin' }
    )
  } catch {
    return {
      content: [
        { type: 'text', text: 'Could not reach the roster service. Try again.' },
      ],
    }
  }
  if (res.status === 401) {
    return {
      content: [
        {
          type: 'text',
          text: 'You are not signed in, so no roster is available. Sign in first.',
        },
      ],
    }
  }
  if (res.status === 403) {
    return {
      content: [
        {
          type: 'text',
          text: 'Rosters are visible to team managers only, and the signed-in user is not a manager of the active team.',
        },
      ],
    }
  }
  if (!res.ok) {
    return {
      content: [
        {
          type: 'text',
          text: 'The roster could not be loaded. Try again.',
        },
      ],
    }
  }
  const data = (await res.json()) as RosterApiResponse
  // Safety valve on output size (Chrome suggests keeping tool outputs short).
  const text = formatRoster(data)
  const capped =
    text.length > 6000 ? text.slice(0, 6000) + '\n…(output truncated)' : text
  return { content: [{ type: 'text', text: capped }] }
}

export const ROSTER_TOOL = {
  name: 'get_roster_week',
  description: DESCRIPTION,
  inputSchema: {
    type: 'object',
    properties: {
      week: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description:
          'Monday of the week to show, as YYYY-MM-DD. Defaults to the current week.',
      },
    },
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
  },
  execute: executeRosterTool,
}
