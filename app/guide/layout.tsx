import Link from 'next/link'

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/guide" className="hover:underline">
          ← All guides
        </Link>
        <span className="mx-2">·</span>
        <Link href="/roster" className="hover:underline">
          Back to roster
        </Link>
      </nav>
      <article className="prose-guide">{children}</article>
    </main>
  )
}
