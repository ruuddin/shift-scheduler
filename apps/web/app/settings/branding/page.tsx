import { redirect } from 'next/navigation'
import { createClient } from '@shift-scheduler/shared/supabase/server'
import { requireOrgManagerForActiveTeam } from '@shift-scheduler/shared/orgs'
import { getBranding } from './actions'
import BrandingForm from './branding-form'

// Manager-only. Branding applies to the active team.
export default async function BrandingSettingsPage() {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (preview) redirect('/dashboard')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let teamName = 'your team'
  try {
    const m = await requireOrgManagerForActiveTeam()
    teamName = m.teamName
  } catch {
    redirect('/dashboard')
  }

  const branding = await getBranding()

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Team branding</h1>
      <p className="mb-6 text-sm text-zinc-500">
        {teamName} — your logo and colors show across the app.
      </p>
      <BrandingForm initial={branding} />
    </main>
  )
}
