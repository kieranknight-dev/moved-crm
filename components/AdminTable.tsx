// Shared toolbar / table / row-action pieces for the two library tables
// (Workouts, Recipes) — same look, same interaction rules, built once per
// the redesign handoff. Presentational only: every filter, search and action
// still calls exactly the same handlers the tables already had.

import type { ReactNode } from 'react'

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const SearchIcon = () => (
  <svg {...iconProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

export const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const PencilIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

export const DuplicateIcon = () => (
  <svg {...iconProps}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </svg>
)

export const ArchiveIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
    <path d="M10 13h4" />
  </svg>
)

export const RestoreIcon = () => (
  <svg {...iconProps}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
)

export const TrashIcon = () => (
  <svg {...iconProps}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
)

export const MoreIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

// ---------------------------------------------------------------------------
// Toolbar pieces
// ---------------------------------------------------------------------------

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative w-full sm:w-[268px] shrink-0">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-400">
        <SearchIcon />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-pill border border-line-input bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-blush-500 focus:ring-[3px] focus:ring-blush-500/15 transition-colors"
      />
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  labelFor: (v: T) => string
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface-warm p-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-pill px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            value === opt ? 'bg-white text-ink-900 shadow-subtle' : 'text-ink-500 hover:text-ink-900'
          }`}
        >
          {labelFor(opt)}
        </button>
      ))}
    </div>
  )
}

export function DropdownFilter<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  labelFor: (v: T) => string
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none rounded-pill border border-line-input bg-white pl-4 pr-9 py-2 text-xs font-medium text-ink-900 outline-none focus:border-blush-500 transition-colors cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelFor(opt)}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-500">
        <ChevronDownIcon />
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status badge — semantic colour, not blush, so status reads at a glance.
// ---------------------------------------------------------------------------

export type LibraryStatus = 'draft' | 'scheduled' | 'published' | 'archived'

const STATUS_BADGE_STYLES: Record<LibraryStatus, string> = {
  published: 'bg-success-tint text-success',
  scheduled: 'bg-warning-tint text-warning',
  draft: 'bg-surface-warm text-ink-700',
  archived: 'bg-surface-warm text-ink-400',
}

export function StatusBadge({ status, children }: { status: LibraryStatus; children: ReactNode }) {
  return (
    <span
      className={`inline-block rounded-pill px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_STYLES[status]}`}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Row action icon button — 32px, tooltip via title, hover surface-warm.
// ---------------------------------------------------------------------------

export function RowActionButton({
  title,
  onClick,
  disabled,
  tone = 'default',
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'accent'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:bg-surface-warm disabled:opacity-50 ${
        tone === 'accent' ? 'text-blush-600' : 'text-ink-500'
      }`}
    >
      {children}
    </button>
  )
}

export function RowActionLink({
  title,
  href,
  children,
}: {
  title: string
  href: string
  children: ReactNode
}) {
  return (
    <a
      title={title}
      aria-label={title}
      href={href}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-blush-600 transition-colors hover:bg-surface-warm"
    >
      {children}
    </a>
  )
}

// ---------------------------------------------------------------------------
// Sortable column header
// ---------------------------------------------------------------------------

export function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-ink-900 transition-colors"
    >
      {label}
      <ChevronDownIcon className={`transition-transform ${active ? 'opacity-100' : 'opacity-0'} ${dir === 'asc' ? 'rotate-180' : ''}`} />
    </button>
  )
}

export function LoadMoreFooter({
  shown,
  total,
  onLoadMore,
}: {
  shown: number
  total: number
  onLoadMore: () => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 pr-20 md:pr-5 text-xs text-ink-500 border-t border-line-divider">
      <span>
        Showing {shown} of {total}
      </span>
      {shown < total && (
        <button
          type="button"
          onClick={onLoadMore}
          className="font-medium text-blush-600 hover:text-blush-700 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  )
}

export function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const canPrev = page > 1
  const canNext = end < total
  return (
    <div className="flex items-center justify-between px-5 py-3.5 pr-20 md:pr-5 text-xs text-ink-500 border-t border-line-divider">
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] hover:bg-surface-warm disabled:opacity-30 transition-colors rotate-90"
        >
          <ChevronDownIcon />
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] hover:bg-surface-warm disabled:opacity-30 transition-colors -rotate-90"
        >
          <ChevronDownIcon />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile overflow sheet (Edit / Duplicate / Archive, etc.)
// ---------------------------------------------------------------------------

export function OverflowSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <>
      <button
        aria-label="Close menu"
        className="fixed inset-0 z-40 bg-ink-900/20"
        onClick={onClose}
      />
      <div className="fixed bottom-[76px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-sm rounded-card bg-white border border-line-card shadow-cardLg p-2">
        {children}
      </div>
    </>
  )
}

export function OverflowSheetItem({
  onClick,
  href,
  tone = 'default',
  children,
}: {
  onClick?: () => void
  href?: string
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  const cls = `flex w-full items-center gap-2.5 rounded-[14px] px-4 py-3 text-left text-sm transition-colors hover:bg-surface-warm ${
    tone === 'danger' ? 'text-error' : 'text-ink-900'
  }`
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}
