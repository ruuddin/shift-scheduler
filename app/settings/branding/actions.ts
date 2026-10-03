'use server'

import { createClient } from '@/lib/supabase/server'
import { getActiveTeam, getMyTeams } from '@/app/team-actions'
import { logEventAction } from '@/app/event-actions'

export type TeamBranding = {
  logoUrl: string | null
  primaryColor: string | null
}

const DEFAULT_BRANDING: TeamBranding = { logoUrl: null, primaryColor: '#18181b' }

async function requireManager() {
  const activeTeam = await getActiveTeam()
  const teams = await getMyTeams()
  const role = teams.find((t) => t.id === activeTeam?.id)?.role
  if (!activeTeam || role !== 'manager') throw new Error('Not authorized')
  return activeTeam
}

export async function getBranding(): Promise<TeamBranding> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return DEFAULT_BRANDING
  const team = await getActiveTeam()
  if (!team) return DEFAULT_BRANDING
  const supabase = await createClient()
  const { data } = await supabase
    .from('teams')
    .select('logo_url, primary_color')
    .eq('id', team.id)
    .single()
  return {
    logoUrl: (data?.logo_url as string | null) ?? null,
    primaryColor: (data?.primary_color as string | null) ?? DEFAULT_BRANDING.primaryColor,
  }
}

function cleanColor(input: string | null | undefined): string | null {
  if (!input) return null
  const c = input.trim()
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : null
}

function cleanUrl(input: string | null | undefined): string | null {
  if (!input) return null
  const u = input.trim()
  if (!/^https:\/\//.test(u) || u.length > 2048) return null
  return u
}

export async function updateBranding(input: {
  logoUrl?: string | null
  primaryColor?: string | null
}) {
  const team = await requireManager()
  const supabase = await createClient()
  const patch: Record<string, string | null> = {}
  if (input.logoUrl !== undefined) patch.logo_url = cleanUrl(input.logoUrl)
  if (input.primaryColor !== undefined)
    patch.primary_color = cleanColor(input.primaryColor) ?? DEFAULT_BRANDING.primaryColor

  const { error } = await supabase.from('teams').update(patch).eq('id', team.id)
  if (error) throw new Error(error.message)

  await logEventAction({
    eventType: 'team.branding_updated',
    entityType: 'team',
    entityId: team.id,
    metadata: { logoUrl: !!patch.logo_url, primaryColor: patch.primary_color },
  })
  return { ok: true }
}
