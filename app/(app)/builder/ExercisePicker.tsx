'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  EXERCISE_CATEGORY_VALUES,
  EXERCISE_BODY_PART_VALUES,
  type ExerciseBodyPart,
  type ExerciseCategory,
} from '@/lib/types'
import { createExercise } from './actions'

export interface PickerExercise {
  name: string
  category: ExerciseCategory
  bodyPart: ExerciseBodyPart | null
  // Internal-only (Gigi/equipment tagging) — never shown in the browse list
  // or used as a filter, only surfaced in the "add new exercise" form below.
  equipment: string[]
}

type ViewMode = 'all' | 'category' | 'bodyPart'

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'all', label: 'All' },
  { mode: 'category', label: 'Category' },
  { mode: 'bodyPart', label: 'Body Part' },
]

// Modal for choosing an exercise name. Mirrors the iOS ExercisePickerView:
// view-mode switch (All / Category / Body Part) + search with prefix-matches
// ranked above contains-matches (both alphabetical). When a search comes up
// empty, offers a one-off custom name AND a proper "add to the library" form
// (NewExerciseModal below) so a missing exercise never becomes a dead end.
export function ExercisePicker({
  exercises,
  onSelect,
  onClose,
  onExerciseCreated,
}: {
  exercises: PickerExercise[]
  onSelect: (name: string) => void
  onClose: () => void
  onExerciseCreated: (exercise: PickerExercise) => void
}) {
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [category, setCategory] = useState<ExerciseCategory | null>(null)
  const [bodyPart, setBodyPart] = useState<ExerciseBodyPart | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const trimmed = query.trim()

  const categories = useMemo(
    () => EXERCISE_CATEGORY_VALUES.filter((c) => exercises.some((e) => e.category === c)),
    [exercises]
  )
  const bodyParts = useMemo(
    () => EXERCISE_BODY_PART_VALUES.filter((b) => exercises.some((e) => e.bodyPart === b)),
    [exercises]
  )
  const equipmentOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of exercises) for (const eq of e.equipment) set.add(eq)
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [exercises])

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

  const showEmptyState = trimmed.length > 0 && totalShown === 0

  const changeMode = (mode: ViewMode) => {
    setViewMode(mode)
    setCategory(null)
    setBodyPart(null)
  }

  const handleCreated = (exercise: PickerExercise) => {
    onExerciseCreated(exercise)
    setShowCreate(false)
    onSelect(exercise.name)
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
          {showEmptyState && (
            <li className="py-6 text-center border-b border-blush-50">
              <p className="text-sm text-ink-900 font-medium">Exercise not found. Add it?</p>
              <p className="text-xs text-ink-500 mt-1">
                Save “{trimmed}” to the exercise library so it is there next time too.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 rounded-pill bg-blush-500 text-white px-4 py-2 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow"
              >
                Add “{trimmed}” to the library
              </button>
              <button
                onClick={() => onSelect(trimmed)}
                className="block w-full mt-3 text-xs text-ink-500 hover:text-blush-600 transition-colors"
              >
                Or use “{trimmed}” for this workout only
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

          {totalShown === 0 && !showEmptyState && (
            <li className="py-8 text-center text-sm text-ink-500">
              Type to search {exercises.length.toLocaleString()} exercises.
            </li>
          )}
        </ul>
      </div>

      {showCreate && (
        <NewExerciseModal
          initialName={trimmed}
          categories={categories.length > 0 ? categories : EXERCISE_CATEGORY_VALUES}
          bodyParts={bodyParts.length > 0 ? bodyParts : EXERCISE_BODY_PART_VALUES}
          equipmentOptions={equipmentOptions}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
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

// ---------------------------------------------------------------------------
// New exercise form — the inline escape hatch itself. Category/body part/
// equipment are all dropdowns or chip toggles sourced from the real distinct
// values already in the table (passed in from ExercisePicker), never free
// text, so this can't produce near-duplicate values like "Dumbbell" vs
// "Dumbbells".
// ---------------------------------------------------------------------------

function NewExerciseModal({
  initialName,
  categories,
  bodyParts,
  equipmentOptions,
  onClose,
  onCreated,
}: {
  initialName: string
  categories: ExerciseCategory[]
  bodyParts: ExerciseBodyPart[]
  equipmentOptions: string[]
  onClose: () => void
  onCreated: (exercise: PickerExercise) => void
}) {
  const [name, setName] = useState(initialName)
  const [category, setCategory] = useState<ExerciseCategory>(categories[0])
  const [bodyPart, setBodyPart] = useState<ExerciseBodyPart | ''>('')
  const [equipment, setEquipment] = useState<string[]>([])
  const [tracksDistance, setTracksDistance] = useState(false)
  const [tracksCalories, setTracksCalories] = useState(false)
  const [gifUrl, setGifUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleEquipment = (eq: string) =>
    setEquipment((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]))

  const onSave = async () => {
    if (!name.trim()) {
      setError('Give the exercise a name.')
      return
    }
    setError(null)
    setSaving(true)
    const result = await createExercise({
      name,
      category,
      bodyPart: bodyPart || null,
      equipment,
      tracksDistance,
      tracksCalories,
      gifUrl: gifUrl.trim() || null,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onCreated(result.exercise)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink-900/40 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-cardLg sm:rounded-cardLg shadow-cardLg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <span className="w-8" />
          <h2 className="font-display text-base text-ink-900">Add exercise</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-pill bg-blush-50 text-ink-900 hover:bg-blush-100 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Exercise name"
              className="w-full rounded-card bg-blush-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-blush-300"
            />
          </div>

          <div>
            <FieldLabel>Category</FieldLabel>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
              className="w-full rounded-card bg-blush-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-blush-300"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Body part</FieldLabel>
            <select
              value={bodyPart}
              onChange={(e) => setBodyPart(e.target.value as ExerciseBodyPart | '')}
              className="w-full rounded-card bg-blush-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-blush-300"
            >
              <option value="">None</option>
              {bodyParts.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {equipmentOptions.length > 0 && (
            <div>
              <FieldLabel>Equipment required</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {equipmentOptions.map((eq) => (
                  <CategoryPill
                    key={eq}
                    label={eq}
                    active={equipment.includes(eq)}
                    onClick={() => toggleEquipment(eq)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-ink-900">
              <input
                type="checkbox"
                checked={tracksDistance}
                onChange={(e) => setTracksDistance(e.target.checked)}
                className="h-4 w-4 rounded accent-blush-500"
              />
              Tracks distance
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-900">
              <input
                type="checkbox"
                checked={tracksCalories}
                onChange={(e) => setTracksCalories(e.target.checked)}
                className="h-4 w-4 rounded accent-blush-500"
              />
              Tracks calories
            </label>
          </div>

          <div>
            <FieldLabel>GIF URL (optional)</FieldLabel>
            <input
              type="text"
              value={gifUrl}
              onChange={(e) => setGifUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-card bg-blush-50 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-blush-300"
            />
          </div>

          {error && (
            <p className="text-sm text-blush-700 bg-blush-50 border border-blush-100 rounded-card px-4 py-3">
              {error}
            </p>
          )}

          <button
            onClick={onSave}
            disabled={saving}
            className="w-full rounded-pill bg-blush-500 text-white py-3.5 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add to library and use it'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-ink-500 mb-1.5">{children}</p>
}
