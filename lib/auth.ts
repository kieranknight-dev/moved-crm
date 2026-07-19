// The MOVED CRM is a two-person admin tool. There is deliberately no role
// system in v1 (see moved-crm/CLAUDE.md step 3) — access is a fixed email
// allowlist, enforced in three places that must stay in sync:
//   1. the login server action (app/login/actions.ts)
//   2. the middleware (blocks/【signs out non-admins)
//   3. Postgres RLS (public.is_crm_admin() — supabase/migrations)
// Update all three if this list changes.

export const ADMIN_EMAILS = [
  'kieran.knight95@gmail.com',
  'georgiaellis.114@gmail.com',
] as const

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase() as (typeof ADMIN_EMAILS)[number])
}
