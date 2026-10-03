'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isFlagEnabled } from '@/lib/flags'
import { logEventAction } from '@/app/event-actions'

function requireCrudEnabled() {
  if (!isFlagEnabled('shift-crud')) {
    throw new Error('Shift editing is currently disabled')
  }
}

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authorized')
  const { getActiveTeam, getMyTeams } = await import('@/app/team-actions')
  const activeTeam = await getActiveTeam()
  if (!activeTeam) throw new Error('No team selected')
  const teams = await getMyTeams()
  const membership = teams.find((t) => t.id === activeTeam.id)
  if (!membership || membership.role !== 'manager') {
    throw new Error('Not authorized')
  }
  return { supabase, teamId: activeTeam.id }
}

async function employeeName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string
): Promise<string> {
  const { data } = await supabase
    .from('employees')
    .select('name')
    .eq('id', employeeId)
    .single()
  return (data?.name as string | undefined) ?? 'Teammate'
}

function shiftMeta(input: { employee_id: string; starts_at: string; ends_at: string }, employee_name: string) {
  return {
    employee_name,
    date: input.starts_at.slice(0, 10),
    starts_at: input.starts_at.slice(11, 16),
    ends_at: input.ends_at.slice(11, 16),
  }
}

export async function createShiftAction(input: {
  employee_id: string
  starts_at: string
  ends_at: string
}) {
  requireCrudEnabled()
  const { supabase, teamId } = await requireManager()
  const { data, error } = await supabase
    .from('shifts')
    .insert({ ...input, team_id: teamId ?? null, published: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  const name = await employeeName(supabase, input.employee_id)
  await logEventAction({
    eventType: 'shift.created',
    entityType: 'shift',
    entityId: data.id,
    metadata: shiftMeta(input, name),
  })
  revalidatePath('/roster')
  return data
}

export async function updateShiftAction(
  id: string,
  input: { employee_id: string; starts_at: string; ends_at: string }
) {
  requireCrudEnabled()
  const { supabase } = await requireManager()
  const { data, error } = await supabase
    .from('shifts')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  const name = await employeeName(supabase, input.employee_id)
  await logEventAction({
    eventType: 'shift.updated',
    entityType: 'shift',
    entityId: id,
    metadata: shiftMeta(input, name),
  })
  revalidatePath('/roster')
  return data
}

/** Drag-and-drop move: same persistence as update, logged as a move. */
export async function moveShiftAction(
  id: string,
  input: { employee_id: string; starts_at: string; ends_at: string }
) {
  requireCrudEnabled()
  const { supabase } = await requireManager()
  // Capture the pre-move assignment for the event log.
  const { data: before } = await supabase
    .from('shifts')
    .select('employee_id, starts_at')
    .eq('id', id)
    .single()
  const { data, error } = await supabase
    .from('shifts')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  const fromName = before?.employee_id
    ? await employeeName(supabase, before.employee_id as string)
    : '?'
  const toName = await employeeName(supabase, input.employee_id)
  await logEventAction({
    eventType: 'shift.moved',
    entityType: 'shift',
    entityId: id,
    metadata: {
      from_employee_name: fromName,
      to_employee_name: toName,
      from_date: (before?.starts_at as string | undefined)?.slice(0, 10) ?? '',
      to_date: input.starts_at.slice(0, 10),
    },
  })
  revalidatePath('/roster')
  return data
}

export async function deleteShiftAction(id: string) {
  requireCrudEnabled()
  const { supabase } = await requireManager()
  // Capture details for the event log before deleting.
  const { data: before } = await supabase
    .from('shifts')
    .select('employee_id, starts_at, ends_at')
    .eq('id', id)
    .single()
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  const name = before?.employee_id
    ? await employeeName(supabase, before.employee_id as string)
    : 'Teammate'
  await logEventAction({
    eventType: 'shift.deleted',
    entityType: 'shift',
    entityId: id,
    metadata: {
      employee_name: name,
      date: (before?.starts_at as string | undefined)?.slice(0, 10) ?? '',
      starts_at: (before?.starts_at as string | undefined)?.slice(11, 16) ?? '',
      ends_at: (before?.ends_at as string | undefined)?.slice(11, 16) ?? '',
    },
  })
  revalidatePath('/roster')
}
