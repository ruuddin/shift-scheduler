'use client'

import { useState } from 'react'
import {
  toggleGlobalFlag,
  type AdminFlagRow,
} from '@/app/flags-actions'

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export default function AdminFlagsList({ initial }: { initial: AdminFlagRow[] }) {
  const [flags, setFlags] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function onToggle(flagKey: string, enabled: boolean) {
    setBusy(flagKey)
    setError('')
    try {
      await toggleGlobalFlag(flagKey, enabled)
      setFlags((fs) =>
        fs.map((f) =>
          f.flag_key === flagKey ? { ...f, default_enabled: enabled } : f
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {flags.map((f) => (
        <section key={f.flag_key} className="rounded-xl border bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold">{f.flag_key}</h2>
              <p className="mt-0.5 text-sm text-zinc-500">{f.description}</p>
              <p className="mt-2 text-sm">
                Enabled for{' '}
                <strong>
                  {f.teams_enabled}/{f.teams_total} teams
                </strong>{' '}
                · <strong>{f.users_enabled} users</strong>
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <span className="text-zinc-500">Default</span>
              <button
                type="button"
                role="switch"
                aria-checked={f.default_enabled}
                aria-label={`Global default for ${f.flag_key}`}
                disabled={busy === f.flag_key}
                onClick={() => onToggle(f.flag_key, !f.default_enabled)}
                className={`relative h-6 w-11 rounded-full transition ${
                  f.default_enabled ? 'bg-green-600' : 'bg-zinc-300'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    f.default_enabled ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
          {f.team_overrides.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Team overrides
              </p>
              <ul className="space-y-1 text-sm">
                {f.team_overrides.map((o) => (
                  <li key={o.team_id} className="flex justify-between gap-2">
                    <span className="truncate">{o.team_name}</span>
                    <span
                      className={o.enabled ? 'text-green-700' : 'text-zinc-400'}
                    >
                      {o.enabled ? 'on' : 'off'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-400">
            Changing the default affects every team without its own override.
          </p>
        </section>
      ))}
    </div>
  )
}

export function ToggleHistory({
  history,
}: {
  history: {
    id: string
    flag_key: string
    team_name: string | null
    old_enabled: boolean | null
    new_enabled: boolean
    toggled_by_email: string | null
    toggled_at: string
  }[]
}) {
  if (history.length === 0) {
    return <p className="text-sm text-zinc-500">No toggles recorded yet.</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-zinc-400">
            <th className="px-4 py-2">When</th>
            <th className="px-4 py-2">Flag</th>
            <th className="px-4 py-2">Scope</th>
            <th className="px-4 py-2">Change</th>
            <th className="px-4 py-2">Who</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id} className="border-b last:border-0">
              <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                {fmtTime(h.toggled_at)}
              </td>
              <td className="px-4 py-2 font-medium">{h.flag_key}</td>
              <td className="px-4 py-2">{h.team_name ?? 'Global default'}</td>
              <td className="whitespace-nowrap px-4 py-2">
                <span className="text-zinc-400">
                  {h.old_enabled === null ? '—' : h.old_enabled ? 'on' : 'off'}
                </span>{' '}
                →{' '}
                <span
                  className={h.new_enabled ? 'text-green-700' : 'text-zinc-500'}
                >
                  {h.new_enabled ? 'on' : 'off'}
                </span>
              </td>
              <td className="px-4 py-2 text-zinc-600">
                {h.toggled_by_email ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
