import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that never need auth state (public funnel). The proxy skips the
// Supabase client setup + session check entirely for these — they are the
// highest-traffic pages and every millisecond here is first-impression
// latency.
const PUBLIC_PATHS = ['/login', '/signup', '/guide']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request })
  }

  // Preview mode (no Supabase keys yet): skip session handling entirely.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session cookie when expired; never throws. For anonymous
  // users (no session cookie) this is local-only — no network call.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Collapse the / -> /roster -> /login chain: send visitors straight to
  // their destination. Anonymous traffic (the common case for /) saves two
  // full round trips.
  if (pathname === '/') {
    const dest = NextResponse.redirect(
      new URL(user ? '/roster' : '/login', request.url)
    )
    // Preserve any refreshed session cookies on the redirect response.
    for (const c of supabaseResponse.cookies.getAll()) {
      dest.cookies.set(c.name, c.value, c)
    }
    return dest
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
