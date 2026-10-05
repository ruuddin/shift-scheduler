import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminFeedbackAction } from '@/app/admin/feedback-actions'
import FeedbackReviewList from './feedback-ui'

export const metadata = {
  title: 'Admin — feedback review — Shift Scheduler',
}

export default async function AdminFeedbackPage() {
  let data
  try {
    data = await getAdminFeedbackAction()
  } catch {
    redirect('/dashboard')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          ← Back to admin
        </Link>
      </nav>
      <h1 className="text-2xl font-bold md:text-3xl">Feedback review</h1>
      <p className="mt-2 text-sm text-zinc-500">
        What users are saying across all clients — mark items reviewed or
        resolved as you work through them.
      </p>
      {data.preview && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Preview mode — no database, so there&apos;s nothing to review.
        </p>
      )}
      <div className="mt-6">
        <FeedbackReviewList initial={data.items} />
      </div>
    </main>
  )
}
