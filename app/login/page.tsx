'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { logEventAction } from '@/lib/event-actions'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    await logEventAction({ eventType: 'auth.login', actorEmail: email })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
        <h1 className="mb-1 text-2xl font-bold">Shift Scheduler</h1>
        <p className="mb-6 text-sm text-zinc-500">Sign in to your team</p>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2"
        />
        <label className="mb-1 block text-sm font-medium">Password</label>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2"
        />
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-md bg-zinc-900 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-sm text-zinc-500">
          New team? <Link href="/signup" className="underline">Create an account</Link>
        </p>
      </form>
    </main>
  )
}
