'use client'

import { useCallback, useEffect, useRef } from 'react'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

type Props = {
  /** From the guided-tour feature flag (server-evaluated) */
  enabled: boolean
  dndEnabled: boolean
  crudEnabled: boolean
}

const SEEN_KEY = 'shift-scheduler.tour-seen.v1'

type Step = { element?: string; popover: { title: string; description: string } }

// First-run guided tour of the roster. Flag-gated; auto-starts once per
// browser (localStorage), replayable via the "Take tour" button.
// Picks mobile or desktop anchors based on viewport width.
export default function GuidedTour({ enabled, dndEnabled, crudEnabled }: Props) {
  const driverRef = useRef<Driver | null>(null)

  const startTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy()
      driverRef.current = null
    }
    const mobile =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches
    // Mobile layout uses data-tour-m="…" anchors; desktop uses data-tour="…".
    // The week nav is the same element on both.
    const sel = (name: string) =>
      `[data-tour${mobile ? '-m' : ''}="${name}"]`
    const navSel = '[data-tour="week-nav"]'
    const has = (s: string) => !!document.querySelector(s)

    const steps: Step[] = [
      {
        popover: {
          title: 'Welcome to Shift Scheduler',
          description:
            'This quick tour shows you around the weekly roster. You can replay it anytime with the "Take tour" button.',
        },
      },
    ]
    if (has(navSel)) {
      steps.push({
        element: navSel,
        popover: {
          title: 'Move between weeks',
          description:
            'Jump to the previous or next week, or snap back to the current week.',
        },
      })
    }
    const gridSel = sel('grid')
    if (has(gridSel)) {
      steps.push({
        element: gridSel,
        popover: {
          title: 'Your weekly roster',
          description: mobile
            ? 'Pick a day to see who works it. Every teammate gets a card with their shifts for that day.'
            : 'Every row is a team member, every column a day. Published shifts show up here for the whole team.',
        },
      })
    }
    const shiftSel = sel('shift')
    if ((dndEnabled || crudEnabled) && has(shiftSel)) {
      const desc = mobile
        ? 'Tap a shift to edit or delete it.'
        : [
            dndEnabled ? 'Drag a shift to move it to another day or teammate.' : '',
            crudEnabled ? 'Click a shift to edit or delete it.' : '',
          ]
            .filter(Boolean)
            .join(' ')
      steps.push({
        element: shiftSel,
        popover: { title: 'Shifts', description: desc },
      })
    }
    const cellSel = sel('cell')
    if (crudEnabled && has(cellSel)) {
      steps.push({
        element: cellSel,
        popover: {
          title: 'Add a shift',
          description: mobile
            ? 'Tap + Add on any teammate to add a shift for the selected day.'
            : 'Click any empty cell to add a shift for that person and day.',
        },
      })
    }
    steps.push({
      popover: {
        title: "You're all set",
        description:
          'That\'s the roster. Invite your team from the dashboard and publish the week when it\'s ready.',
      },
    })

    driverRef.current = driver({
      showProgress: true,
      allowClose: true,
      onDestroyed: () => {
        try {
          localStorage.setItem(SEEN_KEY, '1')
        } catch {
          // private mode — tour will simply show again next visit
        }
        driverRef.current = null
      },
      steps,
    })
    driverRef.current.drive()
  }, [dndEnabled, crudEnabled])

  useEffect(() => {
    if (!enabled) return
    let seen = false
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1'
    } catch {
      // ignore
    }
    if (seen) return
    const t = setTimeout(startTour, 600)
    return () => clearTimeout(t)
  }, [enabled, startTour])

  useEffect(() => {
    return () => driverRef.current?.destroy()
  }, [])

  if (!enabled) return null

  return (
    <button
      onClick={startTour}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
    >
      Take tour
    </button>
  )
}
