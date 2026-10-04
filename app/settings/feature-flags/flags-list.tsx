'use client'

import { useState } from 'react'
import { toggleTeamFlag, type ManagerFlagRow } from '@/app/flags-actions'

function Toggle({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  disabled: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        on ? 'bg-green-600' : 'bg-zinc-300'
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export default function ManagerFlagsList({
  initial,
}: {
  initial: ManagerFlagRow[]
}) {
  const [flags, setFlags] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function onToggle(flagKey: string, enabled: boolean) {
    setBusy(flagKey)
    setError('')
    try {
      await toggleTeamFlag(flagKey, enabled)
      setFlags((fs) =>
        fs.map((f) => (f.flag_key === flagKey ? { ...f, enabled_for_team: enabled } : f))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {flags.map((f) => (
        <div
          key={f.flag_key}
          className="flex items-start justify-between gap-4 rounded-xl border bg-white p-4"
        >
          <div className="min-w-0">
            <p className="font-medium">{f.flag_key}</p>
            <p className="mt-0.5 text-sm text-zinc-500">{f.description}</p>
            <p className="mt-1 text-xs text-zinc-400">
              On for {f.teams_enabled} of {f.teams_total} teams · {f.users_enabled} users
            </p>
          </div>
          <Toggle
            on={f.enabled_for_team}
            onChange={(v) => onToggle(f.flag_key, v)}
            disabled={busy === f.flag_key}
            label={`Toggle ${f.flag_key} for your team`}
          />
        </div>
      ))}
    </div>
  )
}
