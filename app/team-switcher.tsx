'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setActiveTeam, createTeam } from '@/app/team-actions'

type Team = { id: string; name: string; role: string }

export default function TeamSwitcher({
  teams,
  activeId,
}: {
  teams: Team[]
  activeId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const active = teams.find((t) => t.id === activeId) ?? teams[0]

  async function switchTo(id: string) {
    if (id === active?.id) {
      setOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setActiveTeam(id)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch teams.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createTeam(newName.trim())
      setNewName('')
      setCreating(false)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create team.')
    } finally {
      setBusy(false)
    }
  }

  if (teams.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[10rem] truncate">{active?.name ?? 'Select team'}</span>
        <span className="text-xs text-zinc-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-64 rounded-md border bg-white shadow-lg">
          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  role="option"
                  aria-selected={t.id === active?.id}
                  disabled={busy}
                  onClick={() => switchTo(t.id)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 ${
                    t.id === active?.id ? 'font-semibold' : ''
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-zinc-400">{t.role}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t p-2">
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="w-full rounded-md px-4 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50"
              >
                + New team…
              </button>
            ) : (
              <form onSubmit={handleCreate} className="flex gap-2 px-2 py-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Team name"
                  className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !newName.trim()}
                  className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  Create
                </button>
              </form>
            )}
          </div>
          {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
