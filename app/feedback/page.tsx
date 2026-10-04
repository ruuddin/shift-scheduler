import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFeedbackHubAction } from './actions'
import FeedbackClient from './feedback-client'

export const metadata = {
  title: 'Feedback — Shift Scheduler',
}

export default async function FeedbackPage() {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!preview) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')
  }
  const hub = await getFeedbackHubAction()
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:underline">
          ← Back to dashboard
        </Link>
      </nav>
      <FeedbackClient hub={hub} />
    </main>
  )
}
