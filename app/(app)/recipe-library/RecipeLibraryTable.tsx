'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { RecipeStatus } from '@/lib/types'
import { RECIPE_CATEGORIES } from '@/lib/types'
import {
  SearchInput,
  Segmented,
  DropdownFilter,
  StatusBadge,
  RowActionButton,
  RowActionLink,
  SortableHeader,
  PaginationFooter,
  OverflowSheet,
  OverflowSheetItem,
  PencilIcon,
  ArchiveIcon,
  RestoreIcon,
  TrashIcon,
  MoreIcon,
} from '@/components/AdminTable'
import { archiveRecipe, restoreRecipe, deleteRecipe } from './actions'

export interface RecipeLibraryRow {
  id: string
  name: string
  category: string
  status: string
  publish_at: string | null
  image_url: string | null
  servings: number
  difficulty: string
  prep_minutes: number
  created_at: string | null
}

const STATUS_FILTERS: (RecipeStatus | 'all')[] = [
  'all',
  'published',
  'scheduled',
  'draft',
  'archived',
]

const CATEGORY_FILTERS: (string | 'all')[] = ['all', ...RECIPE_CATEGORIES.map((c) => c.value)]

const PAGE_SIZE = 10

function categoryLabel(value: string): string {
  return RECIPE_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

function statusLabel(row: RecipeLibraryRow): string {
  if (row.status === 'scheduled' && row.publish_at) {
    return `Scheduled · ${new Date(row.publish_at).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })}`
  }
  return row.status.charAt(0).toUpperCase() + row.status.slice(1)
}

export default function RecipeLibraryTable({ recipes }: { recipes: RecipeLibraryRow[] }) {
  const router = useRouter()
  const [status, setStatus] = useState<RecipeStatus | 'all'>('all')
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
  const [page, setPage] = useState(1)
  const [sheetId, setSheetId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const rows = recipes.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (category === 'all' || r.category === category) &&
        r.name.toLowerCase().includes(search.trim().toLowerCase())
    )
    if (sortDir) {
      rows.sort((a, b) =>
        sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      )
    }
    return rows
  }, [recipes, status, category, search, sortDir])

  // Filters/search/sort changing underneath an existing page number could
  // strand the user on a now-empty page — snap back to page 1.
  useEffect(() => {
    setPage(1)
  }, [status, category, search, sortDir])

  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const sheetRow = sheetId ? recipes.find((r) => r.id === sheetId) ?? null : null

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
          <h1 className="font-display text-2xl text-ink-900">Recipes</h1>
          <p className="text-sm text-ink-500 mt-1">
            {recipes.filter((r) => r.status === 'published').length} published
          </p>
        </div>
        <Link
          href="/recipes"
          className="hidden sm:inline-flex rounded-pill bg-blush-500 text-white px-5 py-2.5 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow"
        >
          + New Recipe
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name…" />
        <Segmented
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          labelFor={(v) => (v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1))}
        />
        <DropdownFilter
          options={CATEGORY_FILTERS}
          value={category}
          onChange={setCategory}
          labelFor={(v) => (v === 'all' ? 'All categories' : categoryLabel(v))}
        />
        <span className="ml-auto text-xs text-ink-500 whitespace-nowrap">
          {filtered.length} recipe{filtered.length === 1 ? '' : 's'}
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
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-surface-header text-ink-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium w-16"></th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  <SortableHeader
                    label="Name"
                    active={sortDir !== null}
                    dir={sortDir ?? 'asc'}
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  />
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Category
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Servings
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Difficulty
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide">
                  Prep
                </th>
                <th className="px-5 py-3 font-semibold text-[11px] uppercase tracking-wide text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-t border-line-divider hover:bg-surface-header transition-colors ${
                    i % 2 === 1 ? 'bg-surface-rowAlt' : 'bg-white'
                  } ${busyId === r.id ? 'opacity-50' : ''}`}
                >
                  <td className="px-5 py-[11px]">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image_url}
                        alt=""
                        className="h-[38px] w-[38px] rounded-[11px] object-cover"
                      />
                    ) : (
                      <div className="h-[38px] w-[38px] rounded-[11px] bg-surface-warm" />
                    )}
                  </td>
                  <td className="px-5 py-[11px] text-ink-900 font-medium">{r.name}</td>
                  <td className="px-5 py-[11px] text-ink-700">{categoryLabel(r.category)}</td>
                  <td className="px-5 py-[11px]">
                    <StatusBadge status={r.status as RecipeStatus}>{statusLabel(r)}</StatusBadge>
                  </td>
                  <td className="px-5 py-[11px] text-ink-700">{r.servings}</td>
                  <td className="px-5 py-[11px] text-ink-700">{r.difficulty}</td>
                  <td className="px-5 py-[11px] text-ink-700">{r.prep_minutes} min</td>
                  <td className="px-5 py-[11px]">
                    <div className="flex items-center justify-end gap-1">
                      <RowActionLink title="Edit" href={`/recipes?id=${r.id}`}>
                        <PencilIcon />
                      </RowActionLink>
                      {r.status === 'archived' ? (
                        <RowActionButton
                          title="Restore"
                          onClick={() => run(r.id, restoreRecipe)}
                          disabled={pending}
                        >
                          <RestoreIcon />
                        </RowActionButton>
                      ) : (
                        <RowActionButton
                          title="Archive"
                          onClick={() => {
                            if (confirm('Archive this recipe? It will be hidden from the app.'))
                              run(r.id, archiveRecipe)
                          }}
                          disabled={pending}
                        >
                          <ArchiveIcon />
                        </RowActionButton>
                      )}
                      <RowActionButton
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Permanently delete "${r.name}"? This can't be undone.`))
                            run(r.id, deleteRecipe)
                        }}
                        disabled={pending}
                      >
                        <TrashIcon />
                      </RowActionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-ink-500">
                    {recipes.length === 0
                      ? 'No recipes yet. Create your first one.'
                      : 'No recipes match these filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <PaginationFooter
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2.5">
        {visible.map((r) => (
          <div key={r.id} className="rounded-card border border-line-card bg-white p-4">
            <div className="flex items-start gap-3">
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image_url}
                  alt=""
                  className="h-[38px] w-[38px] rounded-[11px] object-cover shrink-0"
                />
              ) : (
                <div className="h-[38px] w-[38px] rounded-[11px] bg-surface-warm shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-ink-900 truncate">{r.name}</p>
                <p className="text-xs text-ink-500 mt-1 truncate">
                  {categoryLabel(r.category)} · {r.servings} servings · {r.prep_minutes} min
                </p>
              </div>
              <button
                onClick={() => setSheetId(r.id)}
                aria-label="More actions"
                className="shrink-0 h-11 w-11 -mr-2 -mt-2 flex items-center justify-center text-ink-500"
              >
                <MoreIcon />
              </button>
            </div>
            <div className="mt-2.5">
              <StatusBadge status={r.status as RecipeStatus}>{statusLabel(r)}</StatusBadge>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-500">
            {recipes.length === 0
              ? 'No recipes yet. Create your first one.'
              : 'No recipes match these filters.'}
          </p>
        )}
        {filtered.length > 0 && (
          <div className="pt-2">
            <PaginationFooter
              page={page}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <Link
        href="/recipes"
        aria-label="New recipe"
        className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-blush-500 text-white shadow-cta flex items-center justify-center text-2xl leading-none"
      >
        +
      </Link>

      {/* Mobile overflow sheet */}
      <OverflowSheet open={sheetRow !== null} onClose={() => setSheetId(null)}>
        {sheetRow && (
          <>
            <OverflowSheetItem href={`/recipes?id=${sheetRow.id}`}>
              <PencilIcon /> Edit
            </OverflowSheetItem>
            {sheetRow.status === 'archived' ? (
              <OverflowSheetItem onClick={() => run(sheetRow.id, restoreRecipe)}>
                <RestoreIcon /> Restore
              </OverflowSheetItem>
            ) : (
              <OverflowSheetItem
                onClick={() => {
                  setSheetId(null)
                  if (confirm('Archive this recipe? It will be hidden from the app.'))
                    run(sheetRow.id, archiveRecipe)
                }}
              >
                <ArchiveIcon /> Archive
              </OverflowSheetItem>
            )}
            <OverflowSheetItem
              tone="danger"
              onClick={() => {
                setSheetId(null)
                if (confirm(`Permanently delete "${sheetRow.name}"? This can't be undone.`))
                  run(sheetRow.id, deleteRecipe)
              }}
            >
              <TrashIcon /> Delete
            </OverflowSheetItem>
          </>
        )}
      </OverflowSheet>
    </div>
  )
}
