import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// SERVER-ONLY. Uses the Supabase service role key, which bypasses Row Level
// Security entirely. Never import this module from a Client Component or any
// code that ships to the browser — it must only be used in Server
// Components, Route Handlers, or Server Actions. There is no cookie/session
// handling here (unlike lib/supabase/server.ts) because the service role is
// not a user session; every query made with this client sees the whole
// database regardless of RLS policies.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
