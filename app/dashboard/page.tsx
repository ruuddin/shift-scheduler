import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMyTeams, getActiveTeam } from '@/app/team-actions'
import { getBranding } from '@/app/settings/branding/actions'
import { isFlagEnabledForTeam } from '@/lib/flags'
import SignOutButton from './sign-out-button'
import TeamSwitcher from '@/app/team-switcher'
import OrgSwitcher from '@/app/org-switcher'
import AnnouncementsFeed from './announcements'

export default async function DashboardPage() {
  const preview = !process.env.NEXT_PUBLIC_SUPABASE_URL
  if (preview) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Demo Cafe</h1>
            <p className="text-sm text-zinc-500">
              Signed in as manager@demo.cafe · manager (preview)
            </p>
          </div>
        </div>
        <div className="rounded-xl border p-6">
          <h2 className="mb-2 font-semibold">Manager</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Preview mode — connect Supabase keys to manage your real team.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/roster"
              className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
            >
              Open roster
            </Link>
            <Link
              href="/admin"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Admin
            </Link>
            <Link
              href="/guide"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              User guides
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = (user.user_metadata?.role as string) ?? 'employee'
  const teams = await getMyTeams()
  const activeTeam = await getActiveTeam()
  // Org-first context: the org switcher picks the org, the team switcher
  // only ever lists teams inside it.
  const { getMyOrgs, getActiveOrg } = await import('@/lib/orgs')
  const orgs = await getMyOrgs()
  const activeOrg = await getActiveOrg()
  const branding = await getBranding()
  const brandingOn = activeTeam
    ? await isFlagEnabledForTeam('team-branding', activeTeam.id, user.id)
    : true
  // Manager status now comes from the org role (is_manager), not the
  // legacy per-team employee row.
  const { getTeamOrgId, isOrgManager } = await import('@/lib/orgs')
  const activeOrgId = activeTeam ? await getTeamOrgId(activeTeam.id) : null
  const isManager =
    !!activeOrgId && (await isOrgManager(user.id, activeOrgId))
  // The /admin portal is the SaaS owner's console — never customer managers.
  const { isOwner } = await import('@/lib/owner')
  const showAdmin = await isOwner()
  // Prefer the real team name from the DB; fall back to signup metadata.
  let teamName = (user.user_metadata?.team_name as string) ?? 'Your team'
  if (activeTeam?.name) teamName = activeTeam.name
  // Role is per-team: prefer the role on the active team membership.
  const activeRole = teams.find((t) => t.id === activeTeam?.id)?.role ?? role
  const primaryColor = branding.primaryColor ?? '#18181b'

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {brandingOn && branding.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={`${teamName} logo`}
              className="h-12 w-12 shrink-0 rounded-lg border object-contain"
            />
          )}
          <div className="min-w-0">
            <h1
              className="truncate text-2xl font-bold"
              style={{ color: brandingOn ? primaryColor : undefined }}
            >
              {teamName}
            </h1>
            <p className="text-sm text-zinc-500">
              Signed in as {user.email} · {activeRole}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <OrgSwitcher orgs={orgs} activeId={activeOrg?.id ?? null} />
          <TeamSwitcher teams={teams} activeId={activeTeam?.id ?? null} />
          <SignOutButton />
        </div>
      </div>

      <div className="space-y-4">
        <AnnouncementsFeed />
        {isManager ? (
        <div className="rounded-xl border p-6">
          <h2 className="mb-2 font-semibold">Manager</h2>
          <p className="mb-4 text-sm text-zinc-500">
            The roster builder lands on Day 4–6. For now you can invite your team.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/roster"
              className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
            >
              Open roster
            </Link>
            <Link
              href="/invite"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Invite employees
            </Link>
            {showAdmin && (
              <Link
                href="/admin"
                className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
              >
                Admin
              </Link>
            )}
            <Link
              href="/guide"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              User guides
            </Link>
            <Link
              href="/settings/branding"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Team branding
            </Link>
            <Link
              href="/settings/feature-flags"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Feature flags
            </Link>
            <Link
              href="/settings/organization"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Organization
            </Link>
            <Link
              href="/activity"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Team activity
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border p-6">
          <h2 className="mb-2 font-semibold">My shifts</h2>
          <p className="text-sm text-zinc-500">
            Your published schedule will appear here once your manager builds the
            first week (Day 6).
          </p>
        </div>
      )}
      </div>
    </main>
  )
}
