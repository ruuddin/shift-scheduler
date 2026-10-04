'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  submitFeedbackAction,
  type FeedbackHub,
} from './actions'
import type { FeedbackCategory, FeedbackItem } from '@/lib/feedback'

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug report' },
  { value: 'feature', label: 'Feature request' },
  { value: 'general', label: 'General note' },
]

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusChip({ status }: { status: FeedbackItem['status'] }) {
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

export default function FeedbackClient({ hub }: { hub: FeedbackHub }) {
  const router = useRouter()
  const [category, setCategory] = useState<FeedbackCategory>('general')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!hub.enabled) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-bold">Feedback</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Feedback is currently disabled for your team.
        </p>
      </div>
    )
  }

  async function submit() {
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      await submitFeedbackAction({ category, message, rating })
      setMessage('')
      setRating(null)
      setDone(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit feedback.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold">Feedback</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Tell us what&apos;s broken, what you wish existed, or anything else.
        Your manager and our team can see it.
      </p>

      <div className="mt-6 rounded-xl border bg-white p-4 md:p-6">
        <label className="block text-sm font-medium">
          What is this about?
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  category === c.value
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'hover:bg-zinc-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </label>

        <label className="mt-4 block text-sm font-medium">
          Your feedback
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="e.g. The swap page is confusing on my phone…"
            className="mt-2 block w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-4 text-sm font-medium">
          How are we doing? <span className="font-normal text-zinc-500">(optional)</span>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? null : n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  rating !== null && n <= rating
                    ? 'border-amber-400 bg-amber-50'
                    : 'hover:bg-zinc-50'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {done && (
          <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Thanks — your feedback was submitted.
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || !message.trim()}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send feedback'}
        </button>
      </div>

      {hub.items.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold">My submissions</h2>
          <ul className="mt-3 space-y-3">
            {hub.items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border bg-white p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{item.category}</span>
                  <StatusChip status={item.status} />
                </div>
                <p className="mt-2 break-words text-zinc-700">{item.message}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {fmt(item.created_at)}
                  {item.rating ? ` · ${item.rating}/5` : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
