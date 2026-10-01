import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './sign-out-button'

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
  const teamName = (user.user_metadata?.team_name as string) ?? 'Your team'

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{teamName}</h1>
          <p className="text-sm text-zinc-500">
            Signed in as {user.email} · {role}
          </p>
        </div>
        <SignOutButton />
      </div>

      {role === 'manager' ? (
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
            <Link
              href="/guide"
              className="inline-block rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              User guides
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
    </main>
  )
}
