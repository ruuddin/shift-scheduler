'use client'

import { useState } from 'react'
import { updateBranding } from './actions'

export default function BrandingForm({
  initial,
}: {
  initial: { logoUrl: string | null; primaryColor: string | null }
}) {
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? '')
  const [color, setColor] = useState(initial.primaryColor ?? '#18181b')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setMessage('')
    try {
      await updateBranding({ logoUrl: logoUrl || null, primaryColor: color })
      setStatus('done')
      setMessage('Branding saved.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-white p-6 shadow">
      <label className="mb-1 block text-sm font-medium">Logo image URL</label>
      <p className="mb-2 text-xs text-zinc-500">
        Paste a direct link to your logo (https://…). Square images look best.
      </p>
      <input
        type="url"
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
        placeholder="https://example.com/logo.png"
        className="mb-4 w-full rounded-md border px-3 py-2"
      />

      <label className="mb-1 block text-sm font-medium">Primary color</label>
      <p className="mb-2 text-xs text-zinc-500">
        Used for your team name and key buttons across the app.
      </p>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-md border"
          aria-label="Primary color"
        />
        <code className="rounded bg-zinc-100 px-2 py-1 text-sm">{color}</code>
      </div>

      {logoUrl.trim() && (
        <div className="mb-4">
          <p className="mb-1 text-xs text-zinc-500">Preview</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl.trim()}
            alt="Logo preview"
            className="h-16 w-16 rounded-md border object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
      )}

      {status === 'done' && <p className="mb-4 text-sm text-green-700">{message}</p>}
      {status === 'error' && <p className="mb-4 text-sm text-red-600">{message}</p>}
      <button
        type="submit"
        disabled={status === 'saving'}
        className="w-full rounded-md bg-zinc-900 py-2 text-white disabled:opacity-50"
      >
        {status === 'saving' ? 'Saving…' : 'Save branding'}
      </button>
    </form>
  )
}
