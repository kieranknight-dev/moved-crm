'use client'

import { useMemo, useState } from 'react'
import type { ExerciseCategory } from '@/lib/types'

export interface PickerExercise {
  name: string
  category: ExerciseCategory
}

const CATEGORY_ORDER: ExerciseCategory[] = [
  'Bodyweight',
  'Dumbbell',
  'Barbell',
  'Kettlebell',
  'Machine',
  'Other',
]

// Modal for choosing an exercise name. Mirrors the iOS ExercisePickerView:
// category filter + search with prefix-matches ranked above contains-matches
// (both alphabetical), plus a "Use '<query>'" row for custom names.
export function ExercisePicker({
  exercises,
  onSelect,
  onClose,
}: {
  exercises: PickerExercise[]
  onSelect: (name: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | null>(null)

  const trimmed = query.trim()

  const results = useMemo(() => {
    const byCategory = category
      ? exercises.filter((e) => e.category === category)
      : exercises
    const sortAsc = (a: PickerExercise, b: PickerExercise) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

    if (!trimmed) return [...byCategory].sort(sortAsc)

    const q = trimmed.toLowerCase()
    const prefix = byCategory
      .filter((e) => e.name.toLowerCase().startsWith(q))
      .sort(sortAsc)
    const contains = byCategory
      .filter((e) => !e.name.toLowerCase().startsWith(q) && e.name.toLowerCase().includes(q))
      .sort(sortAsc)
    return [...prefix, ...contains]
  }, [exercises, category, trimmed])

  const showCustomRow = trimmed.length > 0 && results.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/30 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-cardLg sm:rounded-cardLg shadow-cardLg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <span className="w-8" />
          <h2 className="font-display text-base text-ink-900">Choose exercise</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-pill bg-blush-50 text-ink-900 hover:bg-blush-100 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            className="w-full rounded-card bg-blush-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-blush-300"
          />
          <div className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5">
            <CategoryPill
              label="All"
              active={category === null}
              onClick={() => setCategory(null)}
            />
            {CATEGORY_ORDER.map((c) => (
              <CategoryPill
                key={c}
                label={c}
                active={category === c}
                onClick={() => setCategory(c)}
              />
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-5 pb-5">
          {showCustomRow && (
            <li>
              <button
                onClick={() => onSelect(trimmed)}
                className="w-full flex items-center gap-2 py-3 text-left text-blush-600 font-medium"
              >
                <span className="text-blush-500">＋</span>
                Use “{trimmed}”
              </button>
            </li>
          )}
          {results.map((e) => (
            <li key={e.name}>
              <button
                onClick={() => onSelect(e.name)}
                className="w-full flex items-center justify-between py-3 text-left text-sm text-ink-900 border-b border-blush-50 hover:text-blush-600 transition-colors"
              >
                <span>{e.name}</span>
                <span className="text-[11px] text-ink-300">{e.category}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && !showCustomRow && (
            <li className="py-8 text-center text-sm text-ink-500">
              Type to search {exercises.length.toLocaleString()} exercises.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-ink-900 text-white' : 'bg-blush-50 text-ink-500 hover:bg-blush-100'
      }`}
    >
      {label}
    </button>
  )
}
