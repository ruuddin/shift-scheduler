import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTimeOffHubAction } from '@/app/time-off-actions'
import TimeOffClient from './time-off-client'

export const metadata = {
  title: 'Time off & availability — Shift Scheduler',
}

export default async function TimeOffPage() {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!preview) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')
  }
  const hub = await getTimeOffHubAction()
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:underline">
          ← Back to dashboard
        </Link>
      </nav>
      <TimeOffClient hub={hub} />
    </main>
  )
}
