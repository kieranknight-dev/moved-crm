import { createClient } from './server'
import { createAdminClient } from './admin'
import { isAdminEmail } from '@/lib/auth'

// Confirms the caller is an authenticated, allowlisted admin, then hands back a
// service-role client for the write.
//
// Why service role for writes: the coach SELECT policy intentionally hides
// non-published rows from EVERYONE (so the app never shows drafts, even to
// admins). But Postgres blocks an UPDATE whose resulting row would fail the
// SELECT policy — so an admin updating a coach row TO draft/scheduled/archived
// via their own session is rejected by RLS. Rather than loosen the SELECT
// policy (which would leak drafts into the admins' app), CRM writes run as the
// service role. The admin identity check below is the real authorization gate
// (middleware also enforces it); the RLS admin-write policies remain as backup.
export async function requireAdminClient(): Promise<
  { admin: ReturnType<typeof createAdminClient> } | { error: string }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!isAdminEmail(user?.email)) {
    return { error: 'Your account isn’t authorised for the MOVED. CRM.' }
  }
  return { admin: createAdminClient() }
}
