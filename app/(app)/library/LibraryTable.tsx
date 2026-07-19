'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WorkoutStatus, WorkoutFormat } from '@/lib/types'
import { BUILDER_FORMAT_ORDER } from '@/lib/builder'
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

const STATUS_STYLES: Record<WorkoutStatus, string> = {
  published: 'bg-blush-500/10 text-blush-700',
  scheduled: 'bg-blush-50 text-blush-600 border border-blush-100',
  draft: 'bg-ink-300/15 text-ink-500',
  archived: 'bg-ink-300/10 text-ink-300',
}

const STATUS_FILTERS: (WorkoutStatus | 'all')[] = [
  'all',
  'published',
  'scheduled',
  'draft',
  'archived',
]

function statusLabel(row: LibraryRow): string {
  if (row.status === 'scheduled' && row.publish_at) {
    return `Scheduled · ${new Date(row.publish_at).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })}`
  }
  return row.status.charAt(0).toUpperCase() + row.status.slice(1)
}

export default function LibraryTable({ workouts }: { workouts: LibraryRow[] }) {
  const router = useRouter()
  const [status, setStatus] = useState<WorkoutStatus | 'all'>('all')
  const [format, setFormat] = useState<WorkoutFormat | 'all'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      workouts.filter(
        (w) =>
          (status === 'all' || w.status === status) &&
          (format === 'all' || w.format === format)
      ),
    [workouts, status, format]
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
        <h1 className="font-display text-2xl">Workouts</h1>
        <Link
          href="/builder"
          className="rounded-pill bg-blush-500 text-white px-5 py-2.5 text-sm font-medium shadow-cta"
        >
          + New Workout
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-6">
        <FilterRow
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          labelFor={(v) => (v === 'all' ? 'All statuses' : v[0].toUpperCase() + v.slice(1))}
        />
        <FilterRow
          options={['all', ...BUILDER_FORMAT_ORDER]}
          value={format}
          onChange={setFormat}
          labelFor={(v) => (v === 'all' ? 'All formats' : v)}
        />
      </div>

      {error && (
        <div className="rounded-card bg-blush-50 border border-blush-200 p-4 text-sm text-blush-700 mb-6">
          {error}
        </div>
      )}

      <div className="rounded-card border border-blush-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-blush-50 text-ink-500 text-left">
            <tr>
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Format</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Difficulty</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr
                key={w.id}
                className={`border-t border-blush-100 ${busyId === w.id ? 'opacity-50' : ''}`}
              >
                <td className="px-5 py-3 text-ink-900">{w.title}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block rounded-pill px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLES[w.status as WorkoutStatus] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {statusLabel(w)}
                  </span>
                </td>
                <td className="px-5 py-3">{w.format}</td>
                <td className="px-5 py-3">{w.category}</td>
                <td className="px-5 py-3">{w.difficulty}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-3 text-xs">
                    <Link
                      href={`/builder?id=${w.id}`}
                      className="text-blush-600 hover:text-blush-700 font-medium"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => run(w.id, duplicateWorkout)}
                      disabled={pending}
                      className="text-ink-500 hover:text-ink-900 disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    {w.status === 'archived' ? (
                      <button
                        onClick={() => run(w.id, restoreWorkout)}
                        disabled={pending}
                        className="text-ink-500 hover:text-ink-900 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm('Archive this workout? It will be hidden from the app.'))
                            run(w.id, archiveWorkout)
                        }}
                        disabled={pending}
                        className="text-ink-500 hover:text-blush-700 disabled:opacity-50"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-500">
                  {workouts.length === 0
                    ? 'No coach workouts yet. Create your first one.'
                    : 'No workouts match these filters.'}
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
