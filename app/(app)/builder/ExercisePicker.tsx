'use client'

import { useMemo, useState } from 'react'
import type { ExerciseBodyPart, ExerciseCategory } from '@/lib/types'

export interface PickerExercise {
  name: string
  category: ExerciseCategory
  bodyPart: ExerciseBodyPart | null
}

const CATEGORY_ORDER: ExerciseCategory[] = [
  'Bodyweight',
  'Dumbbell',
  'Barbell',
  'Kettlebell',
  'Resistance Band',
  'Cardio',
  'Machine',
  'Other',
]

const BODY_PART_ORDER: ExerciseBodyPart[] = [
  'Upper Body',
  'Lower Body',
  'Abs',
  'Cardio',
  'Full Body',
]

type ViewMode = 'all' | 'category' | 'bodyPart'

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'all', label: 'All' },
  { mode: 'category', label: 'Category' },
  { mode: 'bodyPart', label: 'Body Part' },
]

// Modal for choosing an exercise name. Mirrors the iOS ExercisePickerView:
// view-mode switch (All / Category / Body Part) + search with prefix-matches
// ranked above contains-matches (both alphabetical), plus a "Use '<query>'"
// row for custom names. equipment_required is internal-only (Gigi/equipment
// tagging) and is never surfaced here.
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
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [category, setCategory] = useState<ExerciseCategory | null>(null)
  const [bodyPart, setBodyPart] = useState<ExerciseBodyPart | null>(null)

  const trimmed = query.trim()

  const categories = useMemo(
    () => CATEGORY_ORDER.filter((c) => exercises.some((e) => e.category === c)),
    [exercises]
  )
  const bodyParts = useMemo(
    () => BODY_PART_ORDER.filter((b) => exercises.some((e) => e.bodyPart === b)),
    [exercises]
  )

  const sortAsc = (a: PickerExercise, b: PickerExercise) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

  const search = (list: PickerExercise[]) => {
    if (!trimmed) return [...list].sort(sortAsc)
    const q = trimmed.toLowerCase()
    const prefix = list.filter((e) => e.name.toLowerCase().startsWith(q)).sort(sortAsc)
    const contains = list
      .filter((e) => !e.name.toLowerCase().startsWith(q) && e.name.toLowerCase().includes(q))
      .sort(sortAsc)
    return [...prefix, ...contains]
  }

  // Flat results: "All" mode, or Category/Body Part mode once a specific
  // value is selected via its chip row.
  const flatResults = useMemo(() => {
    let base = exercises
    if (viewMode === 'category' && category) base = base.filter((e) => e.category === category)
    if (viewMode === 'bodyPart' && bodyPart) base = base.filter((e) => e.bodyPart === bodyPart)
    return search(base)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, viewMode, category, bodyPart, trimmed])

  // Grouped sections: Category/Body Part mode with no specific value picked —
  // one section per group (real enum values present in the data), in a
  // fixed order, each sorted/searched the same way as the flat list.
  const sections = useMemo(() => {
    if (viewMode === 'category' && !category) {
      return categories
        .map((c) => ({ label: c, items: search(exercises.filter((e) => e.category === c)) }))
        .filter((s) => s.items.length > 0)
    }
    if (viewMode === 'bodyPart' && !bodyPart) {
      return bodyParts
        .map((b) => ({ label: b, items: search(exercises.filter((e) => e.bodyPart === b)) }))
        .filter((s) => s.items.length > 0)
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, category, bodyPart, categories, bodyParts, exercises, trimmed])

  const totalShown = sections
    ? sections.reduce((n, s) => n + s.items.length, 0)
    : flatResults.length

  const showCustomRow = trimmed.length > 0 && totalShown === 0

  const changeMode = (mode: ViewMode) => {
    setViewMode(mode)
    setCategory(null)
    setBodyPart(null)
  }

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

          <div className="grid grid-cols-3 gap-1 rounded-card bg-blush-50 p-1 mt-3">
            {VIEW_MODES.map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => changeMode(mode)}
                className={`rounded-[14px] py-2 text-sm font-medium transition-colors ${
                  viewMode === mode ? 'bg-white text-ink-900 shadow-card' : 'text-ink-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {viewMode === 'category' && (
            <div className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5">
              <CategoryPill label="All" active={category === null} onClick={() => setCategory(null)} />
              {categories.map((c) => (
                <CategoryPill
                  key={c}
                  label={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
          )}

          {viewMode === 'bodyPart' && (
            <div className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5">
              <CategoryPill label="All" active={bodyPart === null} onClick={() => setBodyPart(null)} />
              {bodyParts.map((b) => (
                <CategoryPill
                  key={b}
                  label={b}
                  active={bodyPart === b}
                  onClick={() => setBodyPart(b)}
                />
              ))}
            </div>
          )}

          {viewMode === 'all' && <div className="h-3" />}
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

          {sections
            ? sections.map((s) => (
                <li key={s.label}>
                  <div className="sticky top-0 bg-white pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-300">
                    {s.label} · {s.items.length}
                  </div>
                  <ul>
                    {s.items.map((e) => (
                      <ExerciseRow key={e.name} exercise={e} onSelect={onSelect} />
                    ))}
                  </ul>
                </li>
              ))
            : flatResults.map((e) => (
                <ExerciseRow key={e.name} exercise={e} onSelect={onSelect} />
              ))}

          {totalShown === 0 && !showCustomRow && (
            <li className="py-8 text-center text-sm text-ink-500">
              Type to search {exercises.length.toLocaleString()} exercises.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

function ExerciseRow({
  exercise,
  onSelect,
}: {
  exercise: PickerExercise
  onSelect: (name: string) => void
}) {
  return (
    <li>
      <button
        onClick={() => onSelect(exercise.name)}
        className="w-full flex items-center justify-between py-3 text-left text-sm text-ink-900 border-b border-blush-50 hover:text-blush-600 transition-colors"
      >
        <span>{exercise.name}</span>
        <span className="text-[11px] text-ink-300">{exercise.category}</span>
      </button>
    </li>
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
