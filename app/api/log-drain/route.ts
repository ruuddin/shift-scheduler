// Log drain ingest — receives Vercel Log Drain payloads and stores them
// in the app_logs table, so function logs survive Vercel's short dashboard
// retention (closes the gap noted in docs/P99-DEBUG-RUNBOOK.md, step 2).
// Setup: docs/LOG-DRAIN.md.
//
// Fail-closed, same pattern as the cron endpoint:
//   - LOG_DRAIN_SECRET unset → endpoint disabled (404).
//   - Set → requests must present it in the `x-log-drain-secret` header
//     (configured as a custom header on the drain in the Vercel dashboard).

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getWriter } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Cap rows per request so a misconfigured or abusive sender can't turn
// one POST into an unbounded insert.
const MAX_ROWS = 1000

type DrainRecord = {
  timestamp?: number
  source?: string
  path?: string
  statusCode?: number
  message?: string
  [key: string]: unknown
}

function secretMatches(provided: string | null, secret: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

function parseRecords(text: string): DrainRecord[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    // JSON array delivery format.
    const arr: unknown = JSON.parse(trimmed)
    return Array.isArray(arr) ? (arr as DrainRecord[]) : []
  }
  // NDJSON delivery format: one JSON object per line.
  return trimmed
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as DrainRecord)
}

export async function POST(req: NextRequest) {
  const secret = process.env.LOG_DRAIN_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!secretMatches(req.headers.get('x-log-drain-secret'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let records: DrainRecord[]
  try {
    records = parseRecords(await req.text())
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  if (records.length === 0) {
    return NextResponse.json({ stored: 0 })
  }

  const rows = records.slice(0, MAX_ROWS).map((r) => ({
    ts: typeof r.timestamp === 'number' ? new Date(r.timestamp).toISOString() : null,
    source: typeof r.source === 'string' ? r.source : null,
    path: typeof r.path === 'string' ? r.path : null,
    status_code: typeof r.statusCode === 'number' ? r.statusCode : null,
    message: typeof r.message === 'string' ? r.message.slice(0, 4000) : null,
    raw: r,
  }))

  const db = await getWriter()
  const { error } = await db.from('app_logs').insert(rows)
  if (error) {
    console.error('log-drain insert failed:', error.message)
    return NextResponse.json({ error: 'Store failed' }, { status: 500 })
  }
  return NextResponse.json({ stored: rows.length })
}
