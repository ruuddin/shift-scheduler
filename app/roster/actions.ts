'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'manager') {
    throw new Error('Not authorized')
  }
  return { supabase, teamId: user.user_metadata?.team_id as string | undefined }
}

export async function createShiftAction(input: {
  employee_id: string
  starts_at: string
  ends_at: string
}) {
  const { supabase, teamId } = await requireManager()
  const { data, error } = await supabase
    .from('shifts')
    .insert({ ...input, team_id: teamId ?? null, published: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/roster')
  return data
}

export async function updateShiftAction(
  id: string,
  input: { employee_id: string; starts_at: string; ends_at: string }
) {
  const { supabase } = await requireManager()
  const { data, error } = await supabase
    .from('shifts')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/roster')
  return data
}

export async function deleteShiftAction(id: string) {
  const { supabase } = await requireManager()
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/roster')
}
