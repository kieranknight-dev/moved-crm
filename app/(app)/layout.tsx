import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'

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
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-blush-100 p-6 hidden md:flex md:flex-col">
        <div className="font-display text-xl tracking-tight mb-8">
          MOVED<span className="text-blush-500">.</span>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <a
            href="/dashboard"
            className="rounded-pill px-4 py-2 hover:bg-blush-50 transition-colors"
          >
            Dashboard
          </a>
          <a
            href="/library"
            className="rounded-pill px-4 py-2 hover:bg-blush-50 transition-colors"
          >
            Workouts
          </a>
          <a
            href="/builder"
            className="rounded-pill px-4 py-2 hover:bg-blush-50 transition-colors"
          >
            New Workout
          </a>
          <a
            href="/recipe-library"
            className="rounded-pill px-4 py-2 hover:bg-blush-50 transition-colors"
          >
            Recipes
          </a>
          <a
            href="/recipes"
            className="rounded-pill px-4 py-2 hover:bg-blush-50 transition-colors"
          >
            New Recipe
          </a>
        </nav>

        <div className="mt-auto pt-6 border-t border-blush-100">
          {user?.email && (
            <p className="text-xs text-ink-500 mb-2 truncate" title={user.email}>
              {user.email}
            </p>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-ink-500 hover:text-blush-600 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  )
}
