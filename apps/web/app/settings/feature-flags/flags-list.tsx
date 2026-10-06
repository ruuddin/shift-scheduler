'use client'

import { useState } from 'react'
import { toggleTeamFlag, type ManagerFlagRow } from '@/app/flags-actions'
import { bulkApplyFlagsAction } from '@/app/org-actions'

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

function BulkApply({
  flags,
  teams,
  onDone,
}: {
  flags: ManagerFlagRow[]
  teams: { id: string; name: string }[]
  onDone: () => void
}) {
  const [flagKey, setFlagKey] = useState(flags[0]?.flag_key ?? '')
  const [enabled, setEnabled] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(teams.map((t) => t.id))
  )
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  function toggleTeam(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onApply() {
    setBusy(true)
    setResult('')
    try {
      const r = await bulkApplyFlagsAction(flagKey, enabled, [...selected])
      setResult(
        `Applied to ${r.applied.length} team(s)` +
          (r.skipped.length ? `, skipped ${r.skipped.length} (not yours, or blocked by org setting).` : '.')
      )
      onDone()
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Could not apply.')
    } finally {
      setBusy(false)
    }
  }

  if (teams.length < 2 || flags.length === 0) return null

  return (
    <div className="mb-6 rounded-xl border bg-white p-4">
      <p className="font-medium">Apply to multiple teams</p>
      <p className="mb-3 text-sm text-zinc-500">
        Set the same flag state across teams at once — or customize per team
        with the switches below.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={flagKey}
          onChange={(e) => setFlagKey(e.target.value)}
          className="rounded-md border px-2 py-1.5 text-sm"
          aria-label="Flag to apply"
        >
          {flags.map((f) => (
            <option key={f.flag_key} value={f.flag_key}>
              {f.flag_key}
            </option>
          ))}
        </select>
        <select
          value={enabled ? 'on' : 'off'}
          onChange={(e) => setEnabled(e.target.value === 'on')}
          className="rounded-md border px-2 py-1.5 text-sm"
          aria-label="Enable or disable"
        >
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
        <button
          type="button"
          onClick={onApply}
          disabled={busy || selected.size === 0}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'Applying…' : `Apply to ${selected.size} team(s)`}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.has(t.id)}
              onChange={() => toggleTeam(t.id)}
              className="h-4 w-4"
            />
            {t.name}
          </label>
        ))}
      </div>
      {result && <p className="mt-2 text-sm text-zinc-600">{result}</p>}
    </div>
  )
}

export default function ManagerFlagsList({
  initial,
  teams,
}: {
  initial: ManagerFlagRow[]
  teams: { id: string; name: string }[]
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
    <div>
      <BulkApply
        flags={flags}
        teams={teams}
        onDone={() => window.location.reload()}
      />
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
    </div>
  )
}
