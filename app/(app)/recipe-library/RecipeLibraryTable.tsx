'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { RecipeStatus } from '@/lib/types'
import { RECIPE_CATEGORIES } from '@/lib/types'
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

const STATUS_STYLES: Record<RecipeStatus, string> = {
  published: 'bg-blush-500/10 text-blush-700',
  scheduled: 'bg-blush-50 text-blush-600 border border-blush-100',
  draft: 'bg-ink-300/15 text-ink-500',
  archived: 'bg-ink-300/10 text-ink-300',
}

const STATUS_FILTERS: (RecipeStatus | 'all')[] = [
  'all',
  'published',
  'scheduled',
  'draft',
  'archived',
]

const CATEGORY_FILTERS: (string | 'all')[] = ['all', ...RECIPE_CATEGORIES.map((c) => c.value)]

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

  const filtered = useMemo(
    () =>
      recipes.filter(
        (r) =>
          (status === 'all' || r.status === status) &&
          (category === 'all' || r.category === category) &&
          r.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [recipes, status, category, search]
  )

  const run = (id: string, action: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    setBusyId(id)
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
        <h1 className="font-display text-2xl">Recipes</h1>
        <Link
          href="/recipes"
          className="rounded-pill bg-blush-500 text-white px-5 py-2.5 text-sm font-medium shadow-cta"
        >
          + New Recipe
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="space-y-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full max-w-sm rounded-card border border-blush-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-blush-500 transition-colors"
        />
        <FilterRow
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          labelFor={(v) => (v === 'all' ? 'All statuses' : v[0].toUpperCase() + v.slice(1))}
        />
        <FilterRow
          options={CATEGORY_FILTERS}
          value={category}
          onChange={setCategory}
          labelFor={(v) => (v === 'all' ? 'All categories' : categoryLabel(v))}
        />
      </div>

      {error && (
        <div className="rounded-card bg-blush-50 border border-blush-200 p-4 text-sm text-blush-700 mb-6">
          {error}
        </div>
      )}

      <div className="rounded-card border border-blush-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-blush-50 text-ink-500 text-left">
            <tr>
              <th className="px-5 py-3 font-medium w-16"></th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Servings</th>
              <th className="px-5 py-3 font-medium">Difficulty</th>
              <th className="px-5 py-3 font-medium">Prep</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-blush-100 ${busyId === r.id ? 'opacity-50' : ''}`}
              >
                <td className="px-5 py-3">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="h-10 w-10 rounded-card object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-card bg-blush-50" />
                  )}
                </td>
                <td className="px-5 py-3 text-ink-900">{r.name}</td>
                <td className="px-5 py-3 capitalize text-ink-500">{categoryLabel(r.category)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block rounded-pill px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLES[r.status as RecipeStatus] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {statusLabel(r)}
                  </span>
                </td>
                <td className="px-5 py-3">{r.servings}</td>
                <td className="px-5 py-3">{r.difficulty}</td>
                <td className="px-5 py-3">{r.prep_minutes} min</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-3 text-xs">
                    <Link
                      href={`/recipes?id=${r.id}`}
                      className="text-blush-600 hover:text-blush-700 font-medium"
                    >
                      Edit
                    </Link>
                    {r.status === 'archived' ? (
                      <button
                        onClick={() => run(r.id, restoreRecipe)}
                        disabled={pending}
                        className="text-ink-500 hover:text-ink-900 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm('Archive this recipe? It will be hidden from the app.'))
                            run(r.id, archiveRecipe)
                        }}
                        disabled={pending}
                        className="text-ink-500 hover:text-blush-700 disabled:opacity-50"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Permanently delete "${r.name}"? This can't be undone.`
                          )
                        )
                          run(r.id, deleteRecipe)
                      }}
                      disabled={pending}
                      className="text-ink-500 hover:text-blush-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-ink-500">
                  {recipes.length === 0
                    ? 'No recipes yet. Create your first one.'
                    : 'No recipes match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilterRow<T extends string>({
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
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt ? 'bg-ink-900 text-white' : 'bg-blush-50 text-ink-500 hover:bg-blush-100'
          }`}
        >
          {labelFor(opt)}
        </button>
      ))}
    </div>
  )
}
