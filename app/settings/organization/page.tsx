import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  getOrganizationAction,
  getOrgFlagsAction,
} from '@/app/org-actions'
import OrgSettings from './org-ui'

export const metadata = {
  title: 'Organization settings — Shift Scheduler',
}

// Manager-only. Applies to the active team's organization.
export default async function OrganizationPage() {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (preview) redirect('/dashboard')

  let data
  try {
    const [org, flags] = await Promise.all([
      getOrganizationAction(),
      getOrgFlagsAction(),
    ])
    data = { details: org.details, flags }
  } catch {
    redirect('/dashboard')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:underline">
          ← Back to dashboard
        </Link>
      </nav>
      <h1 className="text-2xl font-bold md:text-3xl">Organization</h1>
      <p className="mt-2 text-sm text-zinc-500">
        <strong>{data.details.org.name}</strong> — roles, reporting lines, and
        org-wide feature flags.
      </p>
      <OrgSettings initial={data.details} flags={data.flags} />
    </main>
  )
}
