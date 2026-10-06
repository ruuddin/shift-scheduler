import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@shift-scheduler/shared/supabase/server'
import { getSwapsAction } from '@/app/swap-actions'
import SwapsClient from './swaps-client'

export const metadata = {
  title: 'Shift swaps — Shift Scheduler',
}

export default async function SwapsPage() {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!preview) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')
  }
  const hub = await getSwapsAction()
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:underline">
          ← Back to dashboard
        </Link>
      </nav>
      <SwapsClient hub={hub} />
    </main>
  )
}
