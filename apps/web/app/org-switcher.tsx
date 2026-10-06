'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setActiveOrg } from '@/app/team-actions'

type Org = { id: string; name: string }

export default function OrgSwitcher({
  orgs,
  activeId,
}: {
  orgs: Org[]
  activeId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const active = orgs.find((o) => o.id === activeId) ?? orgs[0]

  // One org: show it as a label, no switcher needed.
  if (orgs.length <= 1) {
    return (
      <span
        className="max-w-[10rem] truncate px-1 text-sm font-medium text-zinc-500"
        title={active?.name}
      >
        {active?.name ?? ''}
      </span>
    )
  }

  async function switchTo(id: string) {
    if (id === active?.id) {
      setOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setActiveOrg(id)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch organization.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch organization"
      >
        <span className="max-w-[10rem] truncate">{active?.name ?? 'Select org'}</span>
        <span className="text-xs text-zinc-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-64 rounded-md border bg-white shadow-lg">
          <ul role="listbox" className="max-h-64 overflow-auto py-1">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  role="option"
                  aria-selected={o.id === active?.id}
                  disabled={busy}
                  onClick={() => switchTo(o.id)}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 ${
                    o.id === active?.id ? 'font-semibold' : ''
                  }`}
                >
                  <span className="truncate">{o.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
