'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  cancelTimeOffAction,
  decideTimeOffAction,
  requestTimeOffAction,
  saveAvailabilityAction,
  type TimeOffHub,
} from '@/app/time-off-actions'
import type { Availability, TimeOffRequest } from '@shift-scheduler/shared/timeoff'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function StatusChip({ status }: { status: TimeOffRequest['status'] }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    cancelled: 'bg-zinc-100 text-zinc-600',
  }
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  )
}

function RequestForm({ onChanged }: { onChanged: () => void }) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(today)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestTimeOffAction({ startsOn, endsOn, reason })
      setDone(true)
      setReason('')
      onChanged()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-4 md:p-6">
      <h2 className="mb-1 font-semibold">Request time off</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Your manager approves every request before it counts.
      </p>
      {done && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Request sent — your manager will review it.
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">From</span>
            <input
              type="date"
              value={startsOn}
              min={today}
              onChange={(e) => setStartsOn(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">To</span>
            <input
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Reason (optional)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Vacation, appointment…"
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !startsOn || !endsOn}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Send request
        </button>
      </form>
    </section>
  )
}

function AvailabilityForm({
  initial,
  onChanged,
}: {
  initial: Availability[]
  onChanged: () => void
}) {
  const router = useRouter()
  const [days, setDays] = useState<Availability[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function setDay(i: number, patch: Partial<Availability>) {
    setDays((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await saveAvailabilityAction(days)
      setDone(true)
      onChanged()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-4 md:p-6">
      <h2 className="mb-1 font-semibold">My weekly availability</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Tell your manager when you can&apos;t work. Unavailable days are
        excluded; time windows mark part of a day.
      </p>
      {done && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Availability saved.
        </p>
      )}
      <div className="space-y-2">
        {days.map((d, i) => (
          <div
            key={d.weekday}
            className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-sm"
          >
            <span className="w-10 font-medium">{DAYS[d.weekday]}</span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={d.available}
                onChange={(e) => setDay(i, { available: e.target.checked })}
              />
              Available
            </label>
            {d.available && (
              <>
                <input
                  type="time"
                  value={d.unavailable_from ?? ''}
                  onChange={(e) =>
                    setDay(i, { unavailable_from: e.target.value || null })
                  }
                  className="rounded-md border px-1.5 py-1 text-sm"
                  aria-label={`${DAYS[d.weekday]} unavailable from`}
                />
                <span className="text-zinc-400">–</span>
                <input
                  type="time"
                  value={d.unavailable_to ?? ''}
                  onChange={(e) =>
                    setDay(i, { unavailable_to: e.target.value || null })
                  }
                  className="rounded-md border px-1.5 py-1 text-sm"
                  aria-label={`${DAYS[d.weekday]} unavailable to`}
                />
                <span className="text-xs text-zinc-400">unavailable</span>
              </>
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Save availability
      </button>
    </section>
  )
}

function RequestCard({
  req,
  canManage,
  isMine,
  onChanged,
}: {
  req: TimeOffRequest
  canManage: boolean
  isMine: boolean
  onChanged: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(approve: boolean) {
    setBusy(true)
    setError(null)
    try {
      await decideTimeOffAction({ id: req.id, approve })
      onChanged()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not decide.')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    setError(null)
    try {
      await cancelTimeOffAction(req.id)
      onChanged()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {fmtDate(req.starts_on)}
            {req.ends_on !== req.starts_on && <> – {fmtDate(req.ends_on)}</>}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {canManage ? req.employee_name ?? '—' : 'My request'}
            {req.reason && <> · {req.reason}</>}
          </p>
        </div>
        <StatusChip status={req.status} />
      </div>
      {req.status === 'pending' && canManage && (
        <div className="mt-3 flex gap-2 border-t pt-3">
          <button
            onClick={() => decide(true)}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => decide(false)}
            disabled={busy}
            className="rounded-md border px-4 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
      {req.status === 'pending' && isMine && !canManage && (
        <div className="mt-3 border-t pt-3">
          <button
            onClick={cancel}
            disabled={busy}
            className="rounded-md border px-4 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel request
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function TeamAvailability({
  team,
}: {
  team: TimeOffHub['teamAvailability']
}) {
  if (team.length === 0) return null
  return (
    <section className="rounded-xl border p-4 md:p-6">
      <h2 className="mb-4 font-semibold">Team availability</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="pb-2 pr-2 font-medium">Employee</th>
              {DAYS.map((d) => (
                <th key={d} className="pb-2 pr-2 text-center font-medium">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {team.map((e) => (
              <tr key={e.employee_id} className="border-t">
                <td className="py-2 pr-2 font-medium">{e.employee_name}</td>
                {e.days.map((d) => (
                  <td key={d.weekday} className="py-2 pr-2 text-center">
                    {d.available ? (
                      d.unavailable_from && d.unavailable_to ? (
                        <span
                          className="text-xs text-amber-700"
                          title={`Unavailable ${d.unavailable_from}–${d.unavailable_to}`}
                        >
                          ◐
                        </span>
                      ) : (
                        <span className="text-green-700">✓</span>
                      )
                    ) : (
                      <span className="text-red-600">✗</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        ✓ available · ◐ partly unavailable · ✗ unavailable
      </p>
    </section>
  )
}

export default function TimeOffClient({ hub }: { hub: TimeOffHub }) {
  const [, force] = useState(0)
  const onChanged = () => force((n) => n + 1)

  const pending = hub.requests.filter((r) => r.status === 'pending')
  const mine = hub.requests.filter((r) => r.employee_id === hub.myEmployeeId)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Time off & availability</h1>

      {hub.preview && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Preview mode — requests are not persisted without Supabase keys.
        </p>
      )}

      {!hub.enabled && !hub.preview && (
        <div className="rounded-xl border p-6">
          <h2 className="mb-2 font-semibold">Time off is disabled</h2>
          <p className="text-sm text-zinc-500">
            A manager can turn it on under Feature flags (the{' '}
            <code>time-off</code> flag).
          </p>
        </div>
      )}

      {hub.enabled && (
        <>
          {hub.canManage && pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">
                Pending approvals ({pending.length})
              </h2>
              {pending.map((r) => (
                <RequestCard
                  key={r.id}
                  req={r}
                  canManage
                  isMine={false}
                  onChanged={onChanged}
                />
              ))}
            </section>
          )}

          <RequestForm onChanged={onChanged} />
          <AvailabilityForm initial={hub.myAvailability} onChanged={onChanged} />

          {mine.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">My requests</h2>
              {mine.map((r) => (
                <RequestCard
                  key={r.id}
                  req={r}
                  canManage={false}
                  isMine
                  onChanged={onChanged}
                />
              ))}
            </section>
          )}

          {hub.canManage && <TeamAvailability team={hub.teamAvailability} />}

          {hub.requests.length === 0 && (
            <div className="rounded-xl border p-6">
              <p className="text-sm text-zinc-500">
                No time-off requests yet. Request one above — your manager
                approves every request.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
