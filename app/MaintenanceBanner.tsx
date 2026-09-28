import { isFlagEnabled } from '@/lib/flags'
import { inMaintenanceWindow, maintenanceWindowLabel } from '@/lib/maintenance'

// Slim, non-blocking notice shown during the nightly test window.
// Server-rendered in the root layout; gated by the maintenance-banner flag.
export default function MaintenanceBanner() {
  if (!isFlagEnabled('maintenance-banner') || !inMaintenanceWindow()) {
    return null
  }
  return (
    <div
      role="status"
      className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
    >
      Nightly maintenance in progress ({maintenanceWindowLabel()}) — automated
      tests are running. The app stays available.
    </div>
  )
}
