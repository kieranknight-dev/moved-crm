import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

// Request-scoped server client (@supabase/ssr modern getAll/setAll API).
// Reads the caller's session from cookies, so it's subject to RLS as that
// user. For RLS-bypassing admin analytics, use lib/supabase/admin.ts instead.
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll throws when called from a Server Component (cookies are
            // read-only there). Safe to ignore: the middleware refreshes the
            // session on every request, so token rotation still happens.
          }
        },
      },
    }
  )
}
