'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { localInputToIso, type PublishMode } from '@/lib/builder'
import { PublishPanel } from '@/components/PublishPanel'
import { BuilderShell, FormCard, SummaryCard, SummaryRow, WarningStrip } from '@/components/BuilderLayout'
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

  const categoryLabel = RECIPE_CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category

  return (
    <div className="pb-10">
      <h1 className="font-display text-2xl text-ink-900 mb-6">
        {isEditing ? 'Edit recipe' : 'New recipe'}
      </h1>

      <BuilderShell
        form={
          <div className="space-y-6">
            <FormCard title="Basics">
              {/* Name */}
              <div className="mb-5">
                <SubLabel>Recipe name</SubLabel>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Chia Berry Muffins"
                  className="w-full rounded-xl border border-line-input bg-surface-input px-4 py-3 font-display text-[22px] font-semibold text-ink-900 placeholder:text-ink-400 placeholder:font-body placeholder:text-sm outline-none focus:border-blush-500 focus:ring-[3px] focus:ring-blush-500/15 transition-colors"
                />
              </div>

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
                      className="h-16 w-16 rounded-card object-cover border border-line-card"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-card bg-surface-warm grid place-items-center text-ink-400 text-xs">
                      None
                    </div>
                  )}
                  <label className="rounded-pill border border-line-input bg-white px-4 py-2 text-sm font-medium cursor-pointer hover:bg-surface-warm transition-colors">
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
                        className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                          active
                            ? 'bg-success-tint border-success/30 text-success'
                            : 'bg-white border-line-input text-ink-500 hover:bg-surface-warm'
                        }`}
                      >
                        {active && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M20 6 9 17l-5-5"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </FormCard>

            <FormCard title="Ingredients">
              <RowList
                rows={form.ingredients}
                placeholder="e.g. 200g rolled oats"
                onChange={(i, v) => setRow('ingredients', i, v)}
                onAdd={() => addRow('ingredients')}
                onRemove={(i) => removeRow('ingredients', i)}
                addLabel="+ Add ingredient"
              />
            </FormCard>

            <FormCard title="Steps">
              <RowList
                rows={form.steps}
                placeholder="Describe this step"
                numbered
                onChange={(i, v) => setRow('steps', i, v)}
                onAdd={() => addRow('steps')}
                onRemove={(i) => removeRow('steps', i)}
                addLabel="+ Add step"
              />
            </FormCard>
          </div>
        }
        sidebar={
          <>
            <PublishPanel
              mode={publishMode}
              setMode={setPublishMode}
              scheduledLocal={scheduledLocal}
              setScheduledLocal={setScheduledLocal}
              status={
                <span className="rounded-pill bg-surface-warm px-2.5 py-1 text-[11px] font-medium text-ink-500">
                  {isEditing ? 'Editing' : 'New'}
                </span>
              }
            >
              <label className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-line-input px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-ink-900">Pro subscribers only</span>
                  <span className="block text-xs text-ink-500 mt-0.5">Default for launch.</span>
                </span>
                <Toggle checked={form.isPremium} onChange={(v) => set('isPremium', v)} />
              </label>

              {error && (
                <p className="mt-4 text-sm text-error-text bg-error-tint border border-error-border rounded-card px-4 py-3">
                  {error}
                </p>
              )}

              <button
                onClick={onSave}
                disabled={saving || uploading}
                className="mt-4 w-full rounded-pill bg-blush-500 text-white py-3 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow disabled:opacity-50"
              >
                {saveLabel}
              </button>
            </PublishPanel>

            <SummaryCard>
              <SummaryRow label="Category" value={categoryLabel} />
              <SummaryRow label="Prep" value={`${form.prepMinutes} min`} />
              <SummaryRow label="Servings" value={form.servings} />
              <SummaryRow label="Ingredients" value={form.ingredients.filter((i) => i.trim()).length} />
              <SummaryRow label="Steps" value={form.steps.filter((s) => s.trim()).length} />
              <SummaryRow
                label="Tags"
                value={form.dietaryTags.length > 0 ? form.dietaryTags.join(', ') : '—'}
              />
            </SummaryCard>
            {!form.imageUrl && <WarningStrip>No image set for this recipe.</WarningStrip>}
          </>
        }
      />
    </div>
  )
}

// --- local UI helpers (identical styling to the Workout Builder's) ---

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-500 mb-1.5">
      {children}
    </span>
  )
}

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
    <div className="rounded-card bg-surface-warm p-3.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
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
      className={`shrink-0 rounded-pill px-4 py-2 text-sm font-medium border transition-colors ${
        active
          ? 'bg-ink-900 text-white border-ink-900'
          : 'bg-white text-ink-500 border-line-input hover:bg-surface-warm'
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
  rows,
  placeholder,
  numbered,
  addLabel,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: string[]
  placeholder: string
  numbered?: boolean
  addLabel: string
  onChange: (i: number, v: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {numbered && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-pill bg-surface-warm text-[11px] font-medium text-ink-500 tabular-nums">
              {i + 1}
            </span>
          )}
          <input
            type="text"
            value={row}
            placeholder={placeholder}
            onChange={(e) => onChange(i, e.target.value)}
            className="flex-1 rounded-xl border border-line-input bg-surface-input px-4 py-2.5 text-sm outline-none focus:border-blush-500 focus:ring-[3px] focus:ring-blush-500/15 transition-colors"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove"
            className="h-7 w-7 grid place-items-center rounded-pill text-ink-400 hover:text-error transition-colors"
          >
            ✕
          </button>
        </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-card py-3 text-sm font-medium text-center border border-dashed border-line-input text-blush-600 hover:bg-surface-warm transition-colors"
        >
          {addLabel}
        </button>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 rounded-pill transition-colors ${checked ? 'bg-blush-500' : 'bg-line-input'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-pill bg-white shadow-card transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
