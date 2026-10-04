'use client'

import { Suspense, use, useState } from 'react'
import {
  deleteAnnouncementAction,
  getAnnouncementsAction,
  postAnnouncementAction,
} from '@/app/announcement-actions'
import type { Announcement } from '@/lib/announcements'

type FeedData = {
  announcements: Announcement[]
  canPost: boolean
  orgName: string | null
  teams: { id: string; name: string }[]
}

const EMPTY: FeedData = { announcements: [], canPost: false, orgName: null, teams: [] }

function loadFeed(): Promise<FeedData> {
  return getAnnouncementsAction().catch(() => EMPTY)
}

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function Composer({
  orgName,
  teams,
  onPosted,
}: {
  orgName: string
  teams: { id: string; name: string }[]
  onPosted: () => void
}) {
  const [scope, setScope] = useState<'org' | 'teams'>('org')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggleTeam(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function onPost() {
    setBusy(true)
    setError('')
    try {
      await postAnnouncementAction({
        teamIds: scope === 'teams' ? [...selected] : [],
        title,
        body,
      })
      setTitle('')
      setBody('')
      setSelected(new Set())
      setScope('org')
      onPosted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post.')
    } finally {
      setBusy(false)
    }
  }

  const canPost =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (scope === 'org' || selected.size > 0)

  return (
    <div className="mb-4 rounded-xl border bg-zinc-50 p-4">
      <p className="mb-2 text-sm font-medium">New announcement</p>
      <div className="mb-2 flex gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={scope === 'org'}
            onChange={() => setScope('org')}
            className="h-4 w-4"
          />
          Entire organization ({orgName})
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={scope === 'teams'}
            onChange={() => setScope('teams')}
            className="h-4 w-4"
          />
          Specific team{teams.length > 1 ? 's' : ''}
        </label>
      </div>
      {scope === 'teams' && (
        <div className="mb-2 flex flex-wrap gap-2">
          {teams.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-sm"
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
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Title"
        className="mb-2 w-full rounded-md border bg-white px-3 py-2 text-sm"
        aria-label="Announcement title"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="What should everyone know?"
        className="mb-2 w-full rounded-md border bg-white px-3 py-2 text-sm"
        aria-label="Announcement body"
      />
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={onPost}
        disabled={busy || !canPost}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? 'Posting…' : 'Post announcement'}
      </button>
    </div>
  )
}

function Feed({
  promise,
  onRefresh,
}: {
  promise: Promise<FeedData>
  onRefresh: () => void
}) {
  const data = use(promise)

  async function onDelete(id: string) {
    if (!window.confirm('Delete this announcement?')) return
    try {
      await deleteAnnouncementAction(id)
      onRefresh()
    } catch {
      // keep the feed as-is on failure
    }
  }

  // Managers always see the section (so they can post the first one);
  // everyone else only sees it when there is something to read.
  if (!data.canPost && data.announcements.length === 0) return null

  return (
    <section className="rounded-xl border p-6" aria-label="Announcements">
      <h2 className="mb-1 font-semibold">Announcements</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Updates from your managers — newest first.
      </p>
      {data.canPost && data.orgName && (
        <Composer orgName={data.orgName} teams={data.teams} onPosted={onRefresh} />
      )}
      <div className="space-y-3">
        {data.announcements.map((a) => (
          <article key={a.id} className="rounded-lg border p-4">
            <div className="mb-1 flex items-start justify-between gap-3">
              <p className="font-medium">{a.title}</p>
              {data.canPost && (
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  className="shrink-0 text-xs text-zinc-400 hover:text-red-600"
                  aria-label={`Delete announcement: ${a.title}`}
                >
                  Delete
                </button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-zinc-700">{a.body}</p>
            <p className="mt-2 text-xs text-zinc-400">
              {a.team_name ? `Team: ${a.team_name}` : `Entire ${a.org_name}`} ·{' '}
              {a.created_by_email ?? 'Manager'} · {timeAgo(a.created_at)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function AnnouncementsFeed() {
  const [promise, setPromise] = useState(loadFeed)
  return (
    <Suspense fallback={null}>
      <Feed promise={promise} onRefresh={() => setPromise(loadFeed())} />
    </Suspense>
  )
}
