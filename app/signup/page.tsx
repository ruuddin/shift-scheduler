'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// First user of a team signs up here and becomes the manager.
// Tip: in Supabase Auth settings, turn off "Confirm email" for the pilot
// so new users land straight in the dashboard.
export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, team_name: teamName, role: 'manager' } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // If this email was invited as an employee, link the auth user to the row.
    // (Works once Day 3's RLS policies allow it; safe to attempt before then.)
    if (data.user) {
      try {
        await supabase
          .from('employees')
          .update({ user_id: data.user.id })
          .eq('email', email)
          .is('user_id', null)
      } catch {
        /* employees table / RLS lands Day 3 */
      }
    }
    if (!data.session) {
      setCheckEmail(true)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
        <h1 className="mb-1 text-2xl font-bold">Create your team</h1>
        <p className="mb-6 text-sm text-zinc-500">You&apos;ll be the manager</p>
        <label className="mb-1 block text-sm font-medium">Your name</label>
        <input
          required value={name} onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2"
        />
        <label className="mb-1 block text-sm font-medium">Team name</label>
        <input
          required value={teamName} onChange={(e) => setTeamName(e.target.value)}
          placeholder="e.g. Blue Bottle — Hayes Valley"
          className="mb-4 w-full rounded-md border px-3 py-2"
        />
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2"
        />
        <label className="mb-1 block text-sm font-medium">Password</label>
        <input
          type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border px-3 py-2"
        />
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {checkEmail && (
          <p className="mb-4 text-sm text-green-700">
            Account created — check your email to confirm, then sign in.
          </p>
        )}
        <button
          disabled={loading}
          className="w-full rounded-md bg-zinc-900 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create team'}
        </button>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Already have an account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </form>
    </main>
  )
}
