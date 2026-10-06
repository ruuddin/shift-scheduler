/** Numbered step-by-step list shared by all guide pages. */
export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
            {i + 1}
          </span>
          <div className="pt-0.5 text-[15px] leading-relaxed text-zinc-700">
            {item}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Callout box for tips, notes, and warnings. */
export function Note({
  children,
  tone = 'info',
}: {
  children: React.ReactNode
  tone?: 'info' | 'tip' | 'warn'
}) {
  const styles =
    tone === 'tip'
      ? 'border-green-200 bg-green-50 text-green-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-zinc-200 bg-zinc-50 text-zinc-700'
  const label = tone === 'tip' ? 'Tip' : tone === 'warn' ? 'Note' : 'Good to know'
  return (
    <div className={`mt-6 rounded-xl border p-4 text-sm ${styles}`}>
      <p className="mb-1 font-semibold">{label}</p>
      <div>{children}</div>
    </div>
  )
}

/** Page heading block shared by all guide pages. */
export function GuideHeader({
  title,
  blurb,
}: {
  title: string
  blurb: string
}) {
  return (
    <header className="mb-2">
      <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
      <p className="mt-2 text-zinc-500">{blurb}</p>
    </header>
  )
}
