// Database access — reader/writer split.
//
// Contract (see FEATURE-CHECKLIST.md): every DB read goes through
// getReader(), every DB write through getWriter().
//
// Today both resolve to the same Supabase project. The split is
// config-driven so a read replica can be plugged in without touching
// call sites:
//
//   - getReader()  → SUPABASE_READER_URL / SUPABASE_READER_ANON_KEY
//                    (falls back to the standard NEXT_PUBLIC_* keys)
//   - getWriter()  → service-role key when SUPABASE_SERVICE_ROLE_KEY is set
//                    (trusted server-side writes, bypasses RLS);
//                    otherwise falls back to the per-request server client.
//
// Server components/actions pass through the @supabase/ssr cookie-aware
// client so RLS still applies to the signed-in user.

import { createClient as createAnonServerClient } from './supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/** Reads — the replica when configured, else the standard server client. */
export async function getReader() {
  const url = process.env.SUPABASE_READER_URL
  const key = process.env.SUPABASE_READER_ANON_KEY
  if (url && key) {
    // Stateless read client (no per-user cookies): used only for
    // non-user-scoped reads such as cached flag evaluation.
    return createServiceClient(url, key, { auth: { persistSession: false } })
  }
  return createAnonServerClient()
}

/** Writes — service-role when available, else the standard server client. */
export async function getWriter() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_READER_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    return createServiceClient(url, serviceKey, {
      auth: { persistSession: false },
    })
  }
  return createAnonServerClient()
}

export function usingReadReplica(): boolean {
  return !!(
    process.env.SUPABASE_READER_URL && process.env.SUPABASE_READER_ANON_KEY
  )
}
