import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InviteForm from './invite-form'

// Manager-only. Activates once the employees table exists (schema applied Day 3).
export default async function InvitePage() {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (preview) redirect('/dashboard')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'manager') redirect('/dashboard')

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Invite employees</h1>
      <p className="mb-6 text-sm text-zinc-500">
        They&apos;ll sign up with this email and join your team as employees.
      </p>
      <InviteForm />
    </main>
  )
}
