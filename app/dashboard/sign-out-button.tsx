'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logEventAction } from '@/app/event-actions'

export default function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    // Log before the session is destroyed so the actor is still known.
    await logEventAction({ eventType: 'auth.logout' })
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={signOut}
      className="rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
    >
      Sign out
    </button>
  )
}
