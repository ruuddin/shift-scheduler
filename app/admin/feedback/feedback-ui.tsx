'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setFeedbackStatusAction } from '@/app/admin/feedback-actions'
import type { FeedbackItem, FeedbackStatus } from '@/lib/feedback'

const STATUSES: { value: FeedbackStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
]

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusChip({ status }: { status: FeedbackStatus }) {
  const styles: Record<string, string> = {
    new: 'bg-amber-100 text-amber-800',
    reviewed: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
  }
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  )
}

export default function FeedbackReviewList({
  initial,
}: {
  initial: FeedbackItem[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('new')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items =
    filter === 'all' ? initial : initial.filter((i) => i.status === filter)

  async function setStatus(id: string, status: FeedbackStatus) {
    setBusyId(id)
    setError(null)
    try {
      await setFeedbackStatusAction(id, status)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update status.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setFilter(s.value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              filter === s.value
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'hover:bg-zinc-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-6 rounded-xl border bg-white p-6 text-sm text-zinc-500">
          Nothing here. New feedback from any client lands in this queue.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border bg-white p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{item.category}</span>
                  <StatusChip status={item.status} />
                </div>
                <span className="text-xs text-zinc-500">{fmt(item.created_at)}</span>
              </div>
              <p className="mt-2 break-words text-zinc-700">{item.message}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {item.org_name ?? 'Unknown org'}
                {item.email ? ` · ${item.email}` : ''}
                {item.rating ? ` · ${item.rating}/5` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status === 'new' && (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setStatus(item.id, 'reviewed')}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {busyId === item.id ? 'Saving…' : 'Mark reviewed'}
                  </button>
                )}
                {item.status !== 'resolved' && (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setStatus(item.id, 'resolved')}
                    className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-800 hover:bg-green-100 disabled:opacity-50"
                  >
                    {busyId === item.id ? 'Saving…' : 'Mark resolved'}
                  </button>
                )}
                {item.status === 'resolved' && (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => setStatus(item.id, 'reviewed')}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
