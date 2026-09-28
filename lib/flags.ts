// Feature flags — env-controlled kill switches for app features.
//
// Control with the FEATURE_FLAGS env var (comma-separated):
//   FEATURE_FLAGS="guided-tour,maintenance-banner"  enable listed flags
//   FEATURE_FLAGS="all"                             enable everything
//   FEATURE_FLAGS="none"                            disable everything
//   FEATURE_FLAGS="no-dnd-scheduling"               disable one default-on flag
// Unset/empty → every flag falls back to its default below.
//
// Flags are evaluated server-side only (never NEXT_PUBLIC_). Server
// components read them with isFlagEnabled() and pass the results down to
// client components as props.

export const FLAG_DEFAULTS = {
  /** Drag-and-drop moving of shifts on the roster grid */
  'dnd-scheduling': true,
  /** Create / edit / delete shifts (UI + server actions) */
  'shift-crud': true,
  /** First-run guided tour for new users */
  'guided-tour': true,
  /** Nightly maintenance banner during the test window */
  'maintenance-banner': true,
} as const

export type FlagName = keyof typeof FLAG_DEFAULTS

export const ALL_FLAGS = Object.keys(FLAG_DEFAULTS) as FlagName[]

function parseEnv(): Set<string> | null {
  const raw = process.env.FEATURE_FLAGS?.trim().toLowerCase()
  if (!raw) return null
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

export function isFlagEnabled(flag: FlagName): boolean {
  const set = parseEnv()
  if (!set) return FLAG_DEFAULTS[flag]
  if (set.has('none')) return false
  if (set.has('all')) return true
  if (set.has(`no-${flag}`)) return false
  if (set.has(flag)) return true
  return FLAG_DEFAULTS[flag]
}

/** Snapshot of every flag — handy for passing to client components. */
export function getFlags(): Record<FlagName, boolean> {
  return Object.fromEntries(
    ALL_FLAGS.map((f) => [f, isFlagEnabled(f)])
  ) as Record<FlagName, boolean>
}
