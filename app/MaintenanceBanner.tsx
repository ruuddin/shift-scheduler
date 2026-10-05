'use client'

import { useSyncExternalStore } from 'react'
import { inMaintenanceWindow, maintenanceWindowLabel } from '@/lib/maintenance'

// Slim, non-blocking notice shown during the nightly test window.
// Client-rendered: the window depends on the current time, which must not be
// baked into statically-prerendered pages at build time (a server-rendered
// check only reflected the build's clock). The server layout passes the
// deploy-time flag; visibility is decided in the browser on every load.
//
// useSyncExternalStore keeps the server render (always hidden) and the first
// client render in agreement, then flips to the live clock after hydration.

// The window only changes on minute boundaries, so cache the check per minute
// to keep the snapshot stable between store updates.
let cachedMinute = -1
let cachedInWindow = false

function getClientSnapshot(): boolean {
  const minute = Math.floor(Date.now() / 60000)
  if (minute !== cachedMinute) {
    cachedMinute = minute
    cachedInWindow = inMaintenanceWindow(new Date())
  }
  return cachedInWindow
}

function subscribe() {
  return () => {}
}

export default function MaintenanceBanner({ enabled }: { enabled: boolean }) {
  const inWindow = useSyncExternalStore(subscribe, getClientSnapshot, () => false)
  const visible = enabled && inWindow
  return (
    <div
      role="status"
      data-maintenance-banner
      hidden={!visible}
      className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
    >
      Nightly maintenance in progress ({maintenanceWindowLabel()}) — automated
      tests are running. The app stays available.
    </div>
  )
}
