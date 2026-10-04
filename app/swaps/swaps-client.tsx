'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  cancelSwapAction,
  decideSwapAction,
  getCoworkerShiftsAction,
  requestSwapAction,
  type SwapsHub,
} from '@/app/swap-actions'
import type { SwapRequest } from '@/lib/swaps'

function fmt(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusChip({ status }: { status: SwapRequest['status'] }) {
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

function SwapCard({
  swap,
  myEmployeeId,
  canManage,
  coworkers,
  onChanged,
}: {
  swap: SwapRequest
  myEmployeeId: string | null
  canManage: boolean
  coworkers: { id: string; name: string }[]
  onChanged: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignee, setAssignee] = useState(swap.target_employee_id ?? '')
  const isMine = myEmployeeId && swap.requested_by === myEmployeeId
  const isOpen = !swap.target_employee_id

  async function decide(approve: boolean) {
    setBusy(true)
    setError(null)
    try {
      await decideSwapAction({
        id: swap.id,
        approve,
        assigneeEmployeeId: isOpen ? assignee || null : undefined,
      })
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
      await cancelSwapAction(swap.id)
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
            {fmt(swap.shift_starts_at)} –{' '}
            {new Date(swap.shift_ends_at).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            From <strong>{swap.requester_name ?? '—'}</strong>
            {swap.target_name ? (
              <>
                {' '}
                → <strong>{swap.target_name}</strong>
              </>
            ) : (
              <> → open offer</>
            )}
            {swap.target_shift_id && swap.target_shift_starts_at && (
              <>
                {' '}
                (trades {fmt(swap.target_shift_starts_at)})
              </>
            )}
          </p>
          {swap.note && (
            <p className="mt-1 text-sm italic text-zinc-500">“{swap.note}”</p>
          )}
        </div>
        <StatusChip status={swap.status} />
      </div>

      {swap.status === 'pending' && canManage && (
        <div className="mt-3 border-t pt-3">
          {isOpen && (
            <label className="mb-2 block text-sm">
              <span className="mb-1 block text-zinc-500">Assign to</span>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              >
                <option value="">Choose…</option>
                {coworkers
                  .filter((c) => c.id !== swap.requested_by)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => decide(true)}
              disabled={busy || (isOpen && !assignee)}
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
        </div>
      )}

      {swap.status === 'pending' && isMine && !canManage && (
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

function RequestForm({
  hub,
  onChanged,
}: {
  hub: SwapsHub
  onChanged: () => void
}) {
  const router = useRouter()
  const [shiftId, setShiftId] = useState(hub.myShifts[0]?.id ?? '')
  const [mode, setMode] = useState<'give' | 'trade' | 'open'>('give')
  const [coworkerId, setCoworkerId] = useState('')
  const [coworkerShifts, setCoworkerShifts] = useState<
    { id: string; starts_at: string; ends_at: string }[]
  >([])
  const [tradeShiftId, setTradeShiftId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function pickCoworker(id: string) {
    setCoworkerId(id)
    setTradeShiftId('')
    if (id && mode === 'trade') {
      try {
        setCoworkerShifts(await getCoworkerShiftsAction(id))
      } catch {
        setCoworkerShifts([])
      }
    } else {
      setCoworkerShifts([])
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!shiftId) return
    setBusy(true)
    setError(null)
    try {
      await requestSwapAction({
        shiftId,
        targetEmployeeId: mode === 'open' ? null : coworkerId || null,
        targetShiftId: mode === 'trade' ? tradeShiftId || null : null,
        note,
      })
      setDone(true)
      setNote('')
      onChanged()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request swap.')
    } finally {
      setBusy(false)
    }
  }

  if (hub.myShifts.length === 0) return null

  return (
    <section className="rounded-xl border p-4 md:p-6">
      <h2 className="mb-1 font-semibold">Request a swap</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Your manager approves every swap before it takes effect.
      </p>
      {done && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Request sent — your manager will review it.
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">My shift</span>
          <select
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            {hub.myShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {fmt(s.starts_at)} –{' '}
                {new Date(s.ends_at).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm">
          <span className="mb-1 block font-medium">Swap type</span>
          <div className="space-y-1">
            {(
              [
                ['give', 'Give to a coworker'],
                ['trade', 'Trade shifts with a coworker'],
                ['open', 'Open offer — manager picks who covers'],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === v}
                  onChange={() => {
                    setMode(v)
                    if (v !== 'trade') setTradeShiftId('')
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {mode !== 'open' && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Coworker</span>
            <select
              value={coworkerId}
              onChange={(e) => pickCoworker(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">Choose…</option>
              {hub.coworkers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === 'trade' && coworkerId && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Their shift (to trade for)</span>
            <select
              value={tradeShiftId}
              onChange={(e) => setTradeShiftId(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">Choose…</option>
              {coworkerShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {fmt(s.starts_at)} –{' '}
                  {new Date(s.ends_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Reason for the swap…"
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={
            busy ||
            !shiftId ||
            (mode !== 'open' && !coworkerId) ||
            (mode === 'trade' && !tradeShiftId)
          }
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Send request
        </button>
      </form>
    </section>
  )
}

export default function SwapsClient({ hub }: { hub: SwapsHub }) {
  const [, force] = useState(0)
  const onChanged = () => force((n) => n + 1)

  const pending = hub.swaps.filter((s) => s.status === 'pending')
  const decided = hub.swaps.filter((s) => s.status !== 'pending')
  const mine = hub.swaps.filter((s) => s.requested_by === hub.myEmployeeId)
  const offeredToMe =
    hub.myEmployeeId != null
      ? hub.swaps.filter(
          (s) => s.target_employee_id === hub.myEmployeeId && s.requested_by !== hub.myEmployeeId
        )
      : []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Shift swaps</h1>

      {hub.preview && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Preview mode — swaps are not persisted without Supabase keys.
        </p>
      )}

      {!hub.enabled && !hub.preview && (
        <div className="rounded-xl border p-6">
          <h2 className="mb-2 font-semibold">Swaps are disabled</h2>
          <p className="text-sm text-zinc-500">
            A manager can turn them on under Feature flags (the{' '}
            <code>shift-swaps</code> flag).
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
              {pending.map((s) => (
                <SwapCard
                  key={s.id}
                  swap={s}
                  myEmployeeId={hub.myEmployeeId}
                  canManage
                  coworkers={hub.coworkers}
                  onChanged={onChanged}
                />
              ))}
            </section>
          )}

          <RequestForm hub={hub} onChanged={onChanged} />

          {offeredToMe.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">Offered to me</h2>
              {offeredToMe.map((s) => (
                <SwapCard
                  key={s.id}
                  swap={s}
                  myEmployeeId={hub.myEmployeeId}
                  canManage={false}
                  coworkers={hub.coworkers}
                  onChanged={onChanged}
                />
              ))}
            </section>
          )}

          {mine.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">My requests</h2>
              {mine.map((s) => (
                <SwapCard
                  key={s.id}
                  swap={s}
                  myEmployeeId={hub.myEmployeeId}
                  canManage={false}
                  coworkers={hub.coworkers}
                  onChanged={onChanged}
                />
              ))}
            </section>
          )}

          {decided.length > 0 && hub.canManage && (
            <section className="space-y-3">
              <h2 className="font-semibold">Recently decided</h2>
              {decided.slice(0, 10).map((s) => (
                <SwapCard
                  key={s.id}
                  swap={s}
                  myEmployeeId={hub.myEmployeeId}
                  canManage={false}
                  coworkers={hub.coworkers}
                  onChanged={onChanged}
                />
              ))}
            </section>
          )}

          {hub.swaps.length === 0 && (
            <div className="rounded-xl border p-6">
              <p className="text-sm text-zinc-500">
                No swap requests yet. When you need cover, request one above —
                your manager approves every swap.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
