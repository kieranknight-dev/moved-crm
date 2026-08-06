import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import { Sidebar, MobileTabBar } from '@/components/AppNav'

// Shell for the authenticated app (route group — doesn't affect URLs).
// Middleware guarantees a valid admin session before this renders, so the
// user lookup here is just for display (whose account is signed in).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex bg-surface-page">
      <Sidebar userEmail={user?.email ?? null} signOutAction={signOut} />
      <main className="flex-1 p-6 md:p-10 pb-24 md:pb-10">{children}</main>
      <MobileTabBar />
    </div>
  )
}
