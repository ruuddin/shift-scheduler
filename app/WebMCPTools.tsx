'use client'

import { useEffect } from 'react'
import { ROSTER_TOOL } from '@/lib/webmcp/roster-tool'

// Minimal structural type for the WebMCP entry point. The API moved from
// navigator.modelContext to document.modelContext during 2026, so resolve
// whichever the running Chrome exposes — and do nothing at all on browsers
// without WebMCP. Tools are bound to the document's lifetime: the browser
// removes them when the page goes away, so no unregistration is needed for
// a root-layout component that never unmounts.
type ModelContextLike = {
  registerTool: (tool: typeof ROSTER_TOOL) => unknown
}

function resolveModelContext(): ModelContextLike | null {
  const doc = document as unknown as { modelContext?: ModelContextLike }
  const nav = navigator as unknown as { modelContext?: ModelContextLike }
  const mc = doc.modelContext ?? nav.modelContext
  if (!mc || typeof mc.registerTool !== 'function') return null
  return mc
}

// Registers the app's WebMCP tools. Renders nothing.
export default function WebMCPTools({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return
    const mc = resolveModelContext()
    if (!mc) return
    void mc.registerTool(ROSTER_TOOL)
  }, [enabled])
  return null
}
