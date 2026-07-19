import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/auth'

// Runs on every matched request (see middleware.ts). Refreshes the Supabase
// session cookie and enforces the admin allowlist:
//   - no session, not on /login        → redirect to /login
//   - session, email not allowlisted    → sign out, redirect to /login
//   - valid admin session, on /login    → redirect to /dashboard
export async function updateSession(request: NextRequest) {
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

  // IMPORTANT: getUser() must run before any redirect so the session cookie is
  // refreshed. Do not add logic between createServerClient and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isLoginRoute = path === '/login'

  const redirectTo = (pathname: string, error?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    if (error) url.searchParams.set('error', error)
    const res = NextResponse.redirect(url)
    // Preserve any auth cookies set above (incl. sign-out clears).
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  // Signed in but not on the allowlist: revoke and bounce to login.
  if (user && !isAdminEmail(user.email)) {
    await supabase.auth.signOut()
    return redirectTo('/login', 'unauthorized')
  }

  if (!user && !isLoginRoute) {
    return redirectTo('/login')
  }

  if (user && isLoginRoute) {
    return redirectTo('/dashboard')
  }

  return supabaseResponse
}
