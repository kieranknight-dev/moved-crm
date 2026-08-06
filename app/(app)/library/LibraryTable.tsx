'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WorkoutStatus, WorkoutFormat, WorkoutCategory } from '@/lib/types'
import { BUILDER_FORMAT_ORDER, CATEGORIES } from '@/lib/builder'
import { FORMAT_ACCENTS } from '@/components/dashboard'
import {
  SearchInput,
  Segmented,
  DropdownFilter,
  StatusBadge,
  RowActionButton,
  RowActionLink,
  SortableHeader,
  LoadMoreFooter,
  OverflowSheet,
  OverflowSheetItem,
  PencilIcon,
  DuplicateIcon,
  ArchiveIcon,
  RestoreIcon,
  MoreIcon,
} from '@/components/AdminTable'
import { archiveWorkout, restoreWorkout, duplicateWorkout } from './actions'

export interface LibraryRow {
  id: string
  title: string
  format: string
  category: string
  difficulty: string
  status: string
  publish_at: string | null
  created_at: string
}

const STATUS_FILTERS: (WorkoutStatus | 'all')[] = [
  'all',
  'published',
  'scheduled',
  'draft',
  'archived',
]

const PAGE_SIZE = 12

function statusLabel(row: LibraryRow): string {
  if (row.status === 'scheduled' && row.publish_at) {
    return `Scheduled · ${new Date(row.publish_at).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })}`
  }
  return row.status.charAt(0).toUpperCase() + row.status.slice(1)
}

function formatDot(format: string) {
  const color = FORMAT_ACCENTS[format as keyof typeof FORMAT_ACCENTS] ?? '#C6BDB2'
  return (
    <span
      className="inline-block h-[7px] w-[7px] rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

export default function LibraryTable({ workouts }: { workouts: LibraryRow[] }) {
  const router = useRouter()
  const [status, setStatus] = useState<WorkoutStatus | 'all'>('all')
  const [format, setFormat] = useState<WorkoutFormat | 'all'>('all')
  const [category, setCategory] = useState<WorkoutCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [sheetId, setSheetId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const rows = workouts.filter(
      (w) =>
        (status === 'all' || w.status === status) &&
        (format === 'all' || w.format === format) &&
        (category === 'all' || w.category === category) &&
        w.title.toLowerCase().includes(search.trim().toLowerCase())
    )
    if (sortDir) {
      rows.sort((a, b) =>
        sortDir === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
      )
    }
    return rows
  }, [workouts, status, format, category, search, sortDir])

  const visible = filtered.slice(0, visibleCount)
  const sheetRow = sheetId ? workouts.find((w) => w.id === sheetId) ?? null : null

  const run = (id: string, action: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    setBusyId(id)
    setSheetId(null)
    startTransition(async () => {
      const res = await action(id)
      setBusyId(null)
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Workouts</h1>
          <p className="text-sm text-ink-500 mt-1">
            {workouts.filter((w) => w.status === 'published').length} published ·{' '}
            {workouts.filter((w) => w.status === 'archived').length} archived
          </p>
        </div>
        <Link
          href="/builder"
          className="hidden sm:inline-flex rounded-pill bg-blush-500 text-white px-5 py-2.5 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow"
        >
          + New Workout
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search workouts…" />
        <Segmented
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          labelFor={(v) => (v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1))}
        />
        <DropdownFilter
          options={['all', ...BUILDER_FORMAT_ORDER]}
          value={format}
          onChange={setFormat}
          labelFor={(v) => (v === 'all' ? 'All formats' : v)}
        />
        <DropdownFilter
          options={['all', ...CATEGORIES]}
          value={category}
          onChange={setCategory}
          labelFor={(v) => (v === 'all' ? 'All categories' : v)}
        />
        <span className="ml-auto text-xs text-ink-500 whitespace-nowrap">
          {filtered.length} workout{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {error && (
        <div className="rounded-card bg-error-tint border border-error-border p-4 text-sm text-error-text mb-6">
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block rounded-card border border-line-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-surface-header text-ink-500 text-left">
              <tr>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  <SortableHeader
                    label="Title"
                    active={sortDir !== null}
                    dir={sortDir ?? 'asc'}
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  />
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Format
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Category
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Difficulty
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((w, i) => (
                <tr
                  key={w.id}
                  className={`border-t border-line-divider hover:bg-surface-header transition-colors ${
                    i % 2 === 1 ? 'bg-surface-rowAlt' : 'bg-white'
                  } ${busyId === w.id ? 'opacity-50' : ''}`}
                >
                  <td className="px-5 py-[11px] text-ink-900 font-medium">{w.title}</td>
                  <td className="px-5 py-[11px]">
                    <StatusBadge status={w.status as WorkoutStatus}>{statusLabel(w)}</StatusBadge>
                  </td>
                  <td className="px-5 py-[11px] text-ink-700">
                    <span className="inline-flex items-center gap-2">
                      {formatDot(w.format)}
                      {w.format}
                    </span>
                  </td>
                  <td className="px-5 py-[11px] text-ink-700">{w.category}</td>
                  <td className="px-5 py-[11px] text-ink-700">{w.difficulty}</td>
                  <td className="px-5 py-[11px]">
                    <div className="flex items-center justify-end gap-1">
                      <RowActionLink title="Edit" href={`/builder?id=${w.id}`}>
                        <PencilIcon />
                      </RowActionLink>
                      <RowActionButton
                        title="Duplicate"
                        onClick={() => run(w.id, duplicateWorkout)}
                        disabled={pending}
                      >
                        <DuplicateIcon />
                      </RowActionButton>
                      {w.status === 'archived' ? (
                        <RowActionButton
                          title="Restore"
                          onClick={() => run(w.id, restoreWorkout)}
                          disabled={pending}
                        >
                          <RestoreIcon />
                        </RowActionButton>
                      ) : (
                        <RowActionButton
                          title="Archive"
                          onClick={() => {
                            if (confirm('Archive this workout? It will be hidden from the app.'))
                              run(w.id, archiveWorkout)
                          }}
                          disabled={pending}
                        >
                          <ArchiveIcon />
                        </RowActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-500">
                    {workouts.length === 0
                      ? 'No coach workouts yet. Create your first one.'
                      : 'No workouts match these filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <LoadMoreFooter
            shown={visible.length}
            total={filtered.length}
            onLoadMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
          />
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {visible.map((w) => (
          <div key={w.id} className="rounded-card border border-line-card bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-ink-900 truncate">{w.title}</p>
                <p className="text-xs text-ink-500 mt-1 truncate">
                  {w.format} · {w.category} · {w.difficulty}
                </p>
              </div>
              <button
                onClick={() => setSheetId(w.id)}
                aria-label="More actions"
                className="shrink-0 h-11 w-11 -mr-2 -mt-2 flex items-center justify-center text-ink-500"
              >
                <MoreIcon />
              </button>
            </div>
            <div className="mt-2.5">
              <StatusBadge status={w.status as WorkoutStatus}>{statusLabel(w)}</StatusBadge>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-500">
            {workouts.length === 0
              ? 'No coach workouts yet. Create your first one.'
              : 'No workouts match these filters.'}
          </p>
        )}
        {filtered.length > 0 && (
          <div className="pt-2">
            <LoadMoreFooter
              shown={visible.length}
              total={filtered.length}
              onLoadMore={() => setVisibleCount((c) => c + PAGE_SIZE)}
            />
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <Link
        href="/builder"
        aria-label="New workout"
        className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-blush-500 text-white shadow-cta flex items-center justify-center text-2xl leading-none"
      >
        +
      </Link>

      {/* Mobile overflow sheet */}
      <OverflowSheet open={sheetRow !== null} onClose={() => setSheetId(null)}>
        {sheetRow && (
          <>
            <OverflowSheetItem href={`/builder?id=${sheetRow.id}`}>
              <PencilIcon /> Edit
            </OverflowSheetItem>
            <OverflowSheetItem onClick={() => run(sheetRow.id, duplicateWorkout)}>
              <DuplicateIcon /> Duplicate
            </OverflowSheetItem>
            {sheetRow.status === 'archived' ? (
              <OverflowSheetItem onClick={() => run(sheetRow.id, restoreWorkout)}>
                <RestoreIcon /> Restore
              </OverflowSheetItem>
            ) : (
              <OverflowSheetItem
                onClick={() => {
                  setSheetId(null)
                  if (confirm('Archive this workout? It will be hidden from the app.'))
                    run(sheetRow.id, archiveWorkout)
                }}
              >
                <ArchiveIcon /> Archive
              </OverflowSheetItem>
            )}
          </>
        )}
      </OverflowSheet>
    </div>
  )
}
