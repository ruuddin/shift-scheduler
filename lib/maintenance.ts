// Nightly maintenance window, evaluated in America/Los_Angeles.
//
// Default window: 23:00 → 01:00 PT. Override with:
//   MAINTENANCE_WINDOW="23:00-01:00"   (24h clock, PT)
// The window may cross midnight; the check handles that.

const PT = 'America/Los_Angeles'

function ptMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PT,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

function parseWindow(): [number, number] {
  const raw = process.env.MAINTENANCE_WINDOW?.trim()
  const m = raw?.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
  if (m) {
    const start = Number(m[1]) * 60 + Number(m[2])
    const end = Number(m[3]) * 60 + Number(m[4])
    if (start >= 0 && start < 1440 && end >= 0 && end < 1440) return [start, end]
  }
  return [23 * 60, 60] // 23:00 → 01:00 PT
}

export function inMaintenanceWindow(now: Date = new Date()): boolean {
  const [start, end] = parseWindow()
  const cur = ptMinutes(now)
  return start <= end
    ? cur >= start && cur < end
    : cur >= start || cur < end // crosses midnight
}

export function maintenanceWindowLabel(): string {
  const [start, end] = parseWindow()
  const fmt = (mins: number) => {
    const h24 = Math.floor(mins / 60)
    const m = String(mins % 60).padStart(2, '0')
    const suffix = h24 >= 12 ? 'PM' : 'AM'
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${h12}:${m} ${suffix}`
  }
  return `${fmt(start)} – ${fmt(end)} PT`
}
