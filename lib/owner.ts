import { createClient } from './supabase/server'

/**
 * Owner gate: the /admin portal is the SaaS owner's console for managing
 * clients — it is NOT for customer managers.
 *
 * Owners are identified by email via the OWNER_EMAILS env var
 * (comma-separated, case-insensitive). When it is unset, nobody passes —
 * fail closed, with a message that says how to configure it.
 *
 * Preview mode (no Supabase configured) keeps the old demo behavior so
 * preview deployments still render.
 */

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isPreviewMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL
}

export async function isOwner(): Promise<boolean> {
  if (isPreviewMode()) return true
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''
  return email !== '' && ownerEmails().includes(email)
}

/** Throws unless the signed-in user is an owner. Pages catch → redirect. */
export async function requireOwner(): Promise<{ email: string; userId: string }> {
  if (isPreviewMode()) return { email: 'owner@example.com', userId: 'preview-owner' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const email = user.email?.toLowerCase() ?? ''
  if (!ownerEmails().includes(email)) {
    if (ownerEmails().length === 0) {
      throw new Error(
        'Owner access is not configured. Set OWNER_EMAILS in the environment.'
      )
    }
    throw new Error('Owner access only.')
  }
  return { email: user.email ?? '', userId: user.id }
}
