'use client'

import { useState } from 'react'
import { createClient } from '@shift-scheduler/shared/supabase/client'
import { logEventAction } from '@shift-scheduler/shared/event-actions'

export default function InviteForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    const supabase = createClient()
    const { getMyTeam } = await import('@/app/team-actions')
    const team = await getMyTeam()
    if (!team) {
      setStatus('error')
      setMessage('Could not find your team — try signing in again.')
      return
    }
    const { error } = await supabase
      .from('employees')
      .insert({ team_id: team.id, name, email, role: 'employee' })
    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }
    await logEventAction({
      eventType: 'employee.invited',
      entityType: 'employee',
      metadata: { name, email },
    })
    setStatus('done')
    setMessage(`${email} added — they can sign up now.`)
    setName('')
    setEmail('')
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-white p-6 shadow">
      <label className="mb-1 block text-sm font-medium">Name</label>
      <input
        required value={name} onChange={(e) => setName(e.target.value)}
        className="mb-4 w-full rounded-md border px-3 py-2"
      />
      <label className="mb-1 block text-sm font-medium">Email</label>
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        className="mb-4 w-full rounded-md border px-3 py-2"
      />
      {status === 'done' && <p className="mb-4 text-sm text-green-700">{message}</p>}
      {status === 'error' && <p className="mb-4 text-sm text-red-600">{message}</p>}
      <button
        disabled={status === 'saving'}
        className="w-full rounded-md bg-zinc-900 py-2 text-white disabled:opacity-50"
      >
        {status === 'saving' ? 'Adding…' : 'Add employee'}
      </button>
    </form>
  )
}
