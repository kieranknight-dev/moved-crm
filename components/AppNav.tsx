'use client'

// Sidebar (desktop) + bottom tab bar (mobile) for the authenticated app shell.
// Presentational only — same five routes, same sign-out action, no new pages.
// Client component because active-route highlighting needs usePathname().

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const GridIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
)

const ActivityIcon = () => (
  <svg {...iconProps}>
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  </svg>
)

const BookIcon = () => (
  <svg {...iconProps}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z" />
    <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" />
  </svg>
)

const PlusIcon = () => (
  <svg {...iconProps}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

interface NavItem {
  href: string
  label: string
  icon: () => React.JSX.Element
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { href: '/library', label: 'Workouts', icon: ActivityIcon },
  { href: '/builder', label: 'New Workout', icon: PlusIcon },
  { href: '/recipe-library', label: 'Recipes', icon: BookIcon },
  { href: '/recipes', label: 'New Recipe', icon: PlusIcon },
]

// Bottom bar merges the two "New" routes behind a single Create sheet.
const TAB_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { href: '/library', label: 'Workouts', icon: ActivityIcon },
  { href: '/recipe-library', label: 'Recipes', icon: BookIcon },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({
  userEmail,
  signOutAction,
}: {
  userEmail: string | null
  signOutAction: () => void
}) {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-white border-r border-line-card p-6 hidden md:flex md:flex-col">
      <div className="font-display text-xl tracking-tight mb-8">
        MOVED<span className="text-blush-500">.</span>
      </div>
      <nav className="flex flex-col gap-1 text-sm">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-pill px-4 py-2 transition-colors ${
                active
                  ? 'bg-blush-50 text-blush-600 font-medium'
                  : 'text-ink-700 hover:bg-surface-warm'
              }`}
            >
              <Icon />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-line-divider">
        {userEmail && (
          <p className="text-xs text-ink-500 mb-2 truncate" title={userEmail}>
            {userEmail}
          </p>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-ink-500 hover:text-blush-600 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}

export function MobileTabBar() {
  const pathname = usePathname()
  const [createOpen, setCreateOpen] = useState(false)
  const createActive = isActive(pathname, '/builder') || isActive(pathname, '/recipes')

  return (
    <div className="md:hidden">
      {createOpen && (
        <>
          <button
            aria-label="Close create menu"
            className="fixed inset-0 z-40 bg-ink-900/20"
            onClick={() => setCreateOpen(false)}
          />
          <div className="fixed bottom-[64px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-sm rounded-card bg-white border border-line-card shadow-cardLg p-2">
            <Link
              href="/builder"
              onClick={() => setCreateOpen(false)}
              className="flex items-center gap-2.5 rounded-[14px] px-4 py-3 text-sm text-ink-900 hover:bg-surface-warm transition-colors"
            >
              <PlusIcon /> New workout
            </Link>
            <Link
              href="/recipes"
              onClick={() => setCreateOpen(false)}
              className="flex items-center gap-2.5 rounded-[14px] px-4 py-3 text-sm text-ink-900 hover:bg-surface-warm transition-colors"
            >
              <PlusIcon /> New recipe
            </Link>
          </div>
        </>
      )}
      <nav className="fixed bottom-0 inset-x-0 z-50 h-16 bg-white border-t border-line-card grid grid-cols-4">
        {TAB_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                active ? 'text-blush-600' : 'text-ink-500'
              }`}
            >
              <Icon />
              {label}
            </Link>
          )
        })}
        <button
          onClick={() => setCreateOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
            createActive || createOpen ? 'text-blush-600' : 'text-ink-500'
          }`}
        >
          <PlusIcon />
          Create
        </button>
      </nav>
    </div>
  )
}
