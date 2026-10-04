'use client'

import { useState } from 'react'
import { toggleClientOrgFlagAction } from '@/app/admin/actions'
import type { FlagInfo } from '@/lib/flags'

export function ClientOrgFlags({
  orgId,
  initial,
}: {
  orgId: string
  initial: (FlagInfo & { org_enabled: boolean | null })[]
}) {
  const [flags, setFlags] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function onToggle(flagKey: string, enabled: boolean) {
    setBusy(flagKey)
    setError('')
    try {
      await toggleClientOrgFlagAction(orgId, flagKey, enabled)
      setFlags((fs) =>
        fs.map((f) => (f.flag_key === flagKey ? { ...f, org_enabled: enabled } : f))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {flags.map((f) => {
        const on = f.org_enabled === true
        const off = f.org_enabled === false
        return (
          <div
            key={f.flag_key}
            className="flex items-center justify-between gap-3 border-t pt-2 first:border-0 first:pt-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{f.flag_key}</p>
              <p className="text-xs text-zinc-400">
                {f.org_enabled === null
                  ? 'Not set — follows global default'
                  : on
                    ? 'On for the client'
                    : 'Off for the client (ceiling)'}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={busy === f.flag_key}
                onClick={() => onToggle(f.flag_key, true)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                  on ? 'bg-green-600 text-white' : 'border text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                On
              </button>
              <button
                type="button"
                disabled={busy === f.flag_key}
                onClick={() => onToggle(f.flag_key, false)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                  off ? 'bg-zinc-800 text-white' : 'border text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                Off
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
