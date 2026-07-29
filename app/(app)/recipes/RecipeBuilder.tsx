'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { localInputToIso, type PublishMode } from '@/lib/builder'
import { PublishPanel } from '@/components/PublishPanel'
import {
  RECIPE_CATEGORIES,
  RECIPE_DIFFICULTIES,
  DIETARY_TAGS,
  type RecipeCategory,
  type RecipeDifficulty,
  type RecipeFormInput,
} from '@/lib/types'
import { createRecipe, updateRecipe } from './actions'

export interface RecipeBuilderInit {
  recipeId: string
  form: RecipeFormInput
  publishMode: PublishMode
  scheduledLocal: string
}

const EMPTY: RecipeFormInput = {
  name: '',
  category: 'breakfast',
  imageUrl: null,
  prepMinutes: 15,
  difficulty: 'Easy',
  servings: 2,
  dietaryTags: [],
  ingredients: [''],
  steps: [''],
  isPremium: true,
}

export default function RecipeBuilder({ init }: { init?: RecipeBuilderInit }) {
  const router = useRouter()
  const isEditing = init != null
  const [supabase] = useState(() => createClient())
  const [form, setForm] = useState<RecipeFormInput>(init?.form ?? EMPTY)
  const [publishMode, setPublishMode] = useState<PublishMode>(init?.publishMode ?? 'publish')
  const [scheduledLocal, setScheduledLocal] = useState(init?.scheduledLocal ?? '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  const set = <K extends keyof RecipeFormInput>(key: K, value: RecipeFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // --- dynamic list rows (ingredients / steps) ---
  const setRow = (key: 'ingredients' | 'steps', i: number, value: string) =>
    setForm((f) => ({ ...f, [key]: f[key].map((r, idx) => (idx === i ? value : r)) }))
  const addRow = (key: 'ingredients' | 'steps') =>
    setForm((f) => ({ ...f, [key]: [...f[key], ''] }))
  const removeRow = (key: 'ingredients' | 'steps', i: number) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].length > 1 ? f[key].filter((_, idx) => idx !== i) : f[key],
    }))

  const toggleTag = (tag: string) =>
    setForm((f) => ({
      ...f,
      dietaryTags: f.dietaryTags.includes(tag)
        ? f.dietaryTags.filter((t) => t !== tag)
        : [...f.dietaryTags, tag],
    }))

  // --- client-side image upload to recipe-images (admin session → RLS) ---
  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('recipe-images')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) {
      setError(`Image upload failed: ${upErr.message}`)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
    set('imageUrl', data.publicUrl)
    setUploading(false)
  }

  const onSave = () => {
    setError(null)
    // Scheduling is always Sydney wall-clock time (AEST/AEDT), not whatever
    // timezone the admin's browser/device happens to be set to.
    const scheduledIso =
      publishMode === 'schedule' && scheduledLocal ? localInputToIso(scheduledLocal) : null
    startSaving(async () => {
      const result = isEditing
        ? await updateRecipe(init.recipeId, form, publishMode, scheduledIso)
        : await createRecipe(form, publishMode, scheduledIso)
      if (!result.ok) setError(result.error)
      else {
        router.push('/recipe-library')
        router.refresh()
      }
    })
  }

  const saveLabel = saving
    ? 'Saving…'
    : publishMode === 'draft'
      ? 'Save as draft'
      : publishMode === 'schedule'
        ? 'Schedule recipe'
        : 'Publish now'

  return (
    <div className="max-w-2xl pb-24">
      <h1 className="font-display text-2xl text-ink-900 mb-6">
        {isEditing ? 'Edit recipe' : 'New recipe'}
      </h1>

      {/* Name */}
      <input
        type="text"
        value={form.name}
        onChange={(e) => set('name', e.target.value)}
        placeholder="Recipe name"
        className="w-full font-display text-2xl text-ink-900 placeholder:text-ink-300 border-b-2 border-blush-100 pb-2 mb-6 outline-none focus:border-blush-500 transition-colors"
      />

      {/* Category */}
      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {RECIPE_CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              active={form.category === c.value}
              onClick={() => set('category', c.value as RecipeCategory)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Image */}
      <Field label="Image">
        <div className="flex items-center gap-4">
          {form.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imageUrl}
              alt="Recipe"
              className="h-16 w-16 rounded-card object-cover border border-blush-100"
            />
          ) : (
            <div className="h-16 w-16 rounded-card bg-blush-50 grid place-items-center text-ink-300 text-xs">
              None
            </div>
          )}
          <label className="rounded-pill border border-blush-200 px-4 py-2 text-sm font-medium cursor-pointer hover:bg-blush-50 transition-colors">
            {uploading ? 'Uploading…' : form.imageUrl ? 'Replace image' : 'Upload image'}
            <input
              type="file"
              accept="image/*"
              onChange={onImageChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </Field>

      {/* Prep + Servings */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <SettingCard label="Prep time (min)">
          <Stepper value={form.prepMinutes} min={0} max={480} step={5} onChange={(v) => set('prepMinutes', v)} />
        </SettingCard>
        <SettingCard label="Servings">
          <Stepper value={form.servings} min={1} max={6} step={1} onChange={(v) => set('servings', v)} />
        </SettingCard>
      </div>

      {/* Difficulty */}
      <Field label="Difficulty">
        <div className="flex flex-wrap gap-2">
          {RECIPE_DIFFICULTIES.map((d) => (
            <Chip key={d} active={form.difficulty === d} onClick={() => set('difficulty', d as RecipeDifficulty)}>
              {d}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Dietary tags */}
      <Field label="Dietary tags">
        <div className="flex flex-wrap gap-2">
          {DIETARY_TAGS.map((tag) => {
            const active = form.dietaryTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-blush-500 text-white' : 'bg-blush-50 text-ink-500 hover:bg-blush-100'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Ingredients */}
      <RowList
        label="Ingredients"
        rows={form.ingredients}
        placeholder="e.g. 200g rolled oats"
        onChange={(i, v) => setRow('ingredients', i, v)}
        onAdd={() => addRow('ingredients')}
        onRemove={(i) => removeRow('ingredients', i)}
        addLabel="+ Add ingredient"
      />

      {/* Steps (numbered) */}
      <RowList
        label="Steps"
        rows={form.steps}
        placeholder="Describe this step"
        numbered
        onChange={(i, v) => setRow('steps', i, v)}
        onAdd={() => addRow('steps')}
        onRemove={(i) => removeRow('steps', i)}
        addLabel="+ Add step"
      />

      {/* Premium */}
      <label className="flex items-center gap-3 text-sm text-ink-900 mb-2">
        <Toggle checked={form.isPremium} onChange={(v) => set('isPremium', v)} />
        Available to Pro subscribers only
      </label>

      {/* Publish */}
      <PublishPanel
        mode={publishMode}
        setMode={setPublishMode}
        scheduledLocal={scheduledLocal}
        setScheduledLocal={setScheduledLocal}
      />

      {error && (
        <p className="mt-6 text-sm text-blush-700 bg-blush-50 border border-blush-100 rounded-card px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={onSave}
        disabled={saving || uploading}
        className="mt-6 w-full rounded-pill bg-blush-500 text-white py-3.5 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow disabled:opacity-50"
      >
        {saveLabel}
      </button>
    </div>
  )
}

// --- local UI helpers (identical styling to the Workout Builder's) ---

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-500 mb-2">
        {label}
      </span>
      {children}
    </div>
  )
}

function SettingCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card bg-blush-50 p-3.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-300">
        {label}
      </span>
      {children}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-ink-900 text-white' : 'bg-blush-50 text-ink-500 hover:bg-blush-100'
      }`}
    >
      {children}
    </button>
  )
}

function Stepper({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between mt-1">
      <CircleButton onClick={() => onChange(Math.max(min, value - step))}>−</CircleButton>
      <span className="font-display text-xl text-ink-900 tabular-nums">{value}</span>
      <CircleButton onClick={() => onChange(Math.min(max, value + step))}>+</CircleButton>
    </div>
  )
}

function CircleButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid place-items-center rounded-pill bg-white shadow-card text-ink-900 font-medium h-7 w-7 text-sm"
    >
      {children}
    </button>
  )
}

function RowList({
  label,
  rows,
  placeholder,
  numbered,
  addLabel,
  onChange,
  onAdd,
  onRemove,
}: {
  label: string
  rows: string[]
  placeholder: string
  numbered?: boolean
  addLabel: string
  onChange: (i: number, v: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
}) {
  return (
    <Field label={label}>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {numbered && (
              <span className="w-5 text-center text-xs font-medium text-ink-300 tabular-nums">
                {i + 1}
              </span>
            )}
            <input
              type="text"
              value={row}
              placeholder={placeholder}
              onChange={(e) => onChange(i, e.target.value)}
              className="flex-1 rounded-card border border-blush-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-blush-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label="Remove"
              className="h-7 w-7 grid place-items-center rounded-pill text-ink-300 hover:text-blush-600 transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-card py-3 text-sm font-medium text-center border border-dashed border-blush-200 text-blush-600 hover:bg-blush-50 transition-colors"
        >
          {addLabel}
        </button>
      </div>
    </Field>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 rounded-pill transition-colors ${checked ? 'bg-blush-500' : 'bg-blush-100'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-pill bg-white shadow-card transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
