'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  initialBuilderState,
  newBuilderExercise,
  BUILDER_FORMAT_ORDER,
  FORMAT_CHIP_LABEL,
  FORMAT_DESCRIPTION,
  REST_CHIP_VALUES,
  FOR_TIME_CAP_CHIP_VALUES,
  CATEGORIES,
  DIFFICULTIES,
  restChipLabel,
  quantityPillText,
  liveSummaryText,
  estimatedDuration,
  effectiveDuration,
  localInputToIso,
  formatRowDuration,
  repeatCountFor,
  UNIT_STEPPER,
  type BuilderState,
  type BuilderExercise,
  type ExerciseUnit,
  type PublishMode,
} from '@/lib/builder'
import type { ExerciseCategory } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { createCoachWorkout, updateCoachWorkout } from './actions'
import { ExercisePicker, type PickerExercise } from './ExercisePicker'
import { PublishPanel } from '@/components/PublishPanel'
import { BuilderShell, FormCard, SummaryCard, SummaryRow, WarningStrip } from '@/components/BuilderLayout'

// Meaningful-first order for the auto-detected equipment summary — bodyweight
// and "other" are dropped unless they're the only thing present (see
// autoEquipmentFor below).
const EQUIPMENT_ORDER: ExerciseCategory[] = [
  'Dumbbell',
  'Barbell',
  'Kettlebell',
  'Machine',
  'Bodyweight',
  'Other',
]

// Task 3: deterministic equipment auto-detect from the exercise catalog's
// structured category metadata — the union of tags across every exercise in
// the workout, no AI call needed. Exercises not found in the catalog (custom
// free-text names) are silently skipped; the field stays user-editable so a
// gap here is never a dead end.
function autoEquipmentFor(names: string[], catalog: PickerExercise[]): string {
  const byName = new Map(catalog.map((e) => [e.name.toLowerCase(), e.category]))
  const found = new Set<ExerciseCategory>()
  for (const name of names) {
    const cat = byName.get(name.trim().toLowerCase())
    if (cat) found.add(cat)
  }
  const meaningful = EQUIPMENT_ORDER.filter((c) => c !== 'Bodyweight' && c !== 'Other' && found.has(c))
  if (meaningful.length > 0) return meaningful.join(', ')
  if (found.has('Bodyweight')) return 'Bodyweight'
  return ''
}

// EMOM's "rounds" are minutes — everywhere the shared grouped-round UI
// (CustomRoundsSection et al.) needs a noun, it reads it from here rather
// than hardcoding "round", so EMOM/Circuit/Tabata/AMRAP all label correctly
// without diverging copies of the same component.
function roundNoun(format: BuilderState['format']): 'minute' | 'round' {
  return format === 'EMOM' ? 'minute' : 'round'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface BuilderInit {
  workoutId: string
  state: BuilderState
  publishMode: PublishMode
  scheduledLocal: string
}

export default function BuilderClient({
  exercises: initialExercises,
  init,
}: {
  exercises: PickerExercise[]
  init?: BuilderInit
}) {
  const router = useRouter()
  // Local copy so a brand-new exercise created inline via the picker's "add
  // it" escape hatch is searchable immediately, without a full page refetch.
  const [exercises, setExercises] = useState<PickerExercise[]>(initialExercises)
  const [state, setState] = useState<BuilderState>(init?.state ?? initialBuilderState)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const [publishMode, setPublishMode] = useState<PublishMode>(init?.publishMode ?? 'publish')
  const [scheduledLocal, setScheduledLocal] = useState(init?.scheduledLocal ?? '') // datetime-local value
  const isEditing = init != null

  // Auto-detected equipment (Task 3): stays live while the admin hasn't typed
  // into the field themselves. A loaded edit already has a saved value, so it
  // starts "touched" — adding exercises won't clobber Georgia's existing text.
  const [equipmentTouched, setEquipmentTouched] = useState(
    isEditing && init!.state.equipment.trim().length > 0
  )
  useEffect(() => {
    if (equipmentTouched) return
    const auto = autoEquipmentFor(
      state.exercises.map((e) => e.name),
      exercises
    )
    if (auto !== state.equipment) setState((s) => ({ ...s, equipment: auto }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.exercises, equipmentTouched])

  // Picker: editingId set = renaming that exercise; else adding into targetRound.
  const [picker, setPicker] = useState<{ open: boolean; targetRound: number | null; editingId: string | null }>({
    open: false,
    targetRound: null,
    editingId: null,
  })

  // --- image upload (Task 3): same client-side-upload-then-store-public-URL
  // pattern as the Recipe Builder (recipe-images), against workout-images.
  const [supabase] = useState(() => createClient())
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    setImageError(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('workout-images')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) {
      setImageError(`Image upload failed: ${upErr.message}`)
      setUploadingImage(false)
      return
    }
    const { data } = supabase.storage.from('workout-images').getPublicUrl(path)
    set('imageRef', data.publicUrl)
    setUploadingImage(false)
  }

  const set = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const isRoundsMode =
    state.format === 'Circuit' ||
    state.format === 'Tabata' ||
    state.format === 'EMOM' ||
    state.format === 'AMRAP'
  const inCustomRounds = state.isCustomRounds && isRoundsMode

  // --- exercise mutations ---
  const patchExercise = (id: string, patch: Partial<BuilderExercise>) =>
    setState((s) => ({
      ...s,
      exercises: s.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))

  const removeExercise = (id: string) => {
    setState((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== id) }))
    if (expandedId === id) setExpandedId(null)
  }

  const addExercise = (name: string, roundIndex: number | null) => {
    // Build the exercise once, outside the updater — a setState updater must be
    // pure, and crypto.randomUUID() inside one runs twice under StrictMode,
    // desyncing the committed id from expandedId.
    const ex = { ...newBuilderExercise(roundIndex, state.format), name }
    setState((s) => ({ ...s, exercises: [...s.exercises, ex] }))
    setExpandedId(ex.id)
  }

  // --- custom rounds transitions (ported from Swift) ---
  const maxRound = (exs: BuilderExercise[]) => exs.reduce((m, e) => Math.max(m, e.roundIndex ?? 0), 0)

  const enableCustomRounds = () =>
    setState((s) => {
      const allUniform = s.exercises.every((e) => e.roundIndex == null)
      const exercises = allUniform
        ? s.exercises.map((e) => ({ ...e, roundIndex: 1 }))
        : s.exercises
      return {
        ...s,
        exercises,
        customRoundCount: Math.max(1, maxRound(exercises) || 1),
        isCustomRounds: true,
      }
    })

  const disableCustomRounds = () =>
    setState((s) => ({
      ...s,
      exercises: s.exercises
        .filter((e) => (e.roundIndex ?? 1) === 1)
        .map((e) => ({ ...e, roundIndex: null })),
      isCustomRounds: false,
    }))

  const hasDiscardableRounds = state.exercises.some((e) => (e.roundIndex ?? 1) > 1)

  const onRoundsModeChange = (custom: boolean) => {
    const noun = roundNoun(state.format)
    if (custom) enableCustomRounds()
    else if (hasDiscardableRounds) {
      if (
        confirm(
          `Switching to “Same every ${noun}” keeps ${capitalize(noun)} 1’s exercises and discards the rest.`
        )
      )
        disableCustomRounds()
    } else disableCustomRounds()
  }

  const addRound = () => set('customRoundCount', state.customRoundCount + 1)

  const setRoundRepeat = (round: number, count: number) =>
    setState((s) => ({
      ...s,
      roundRepeats: { ...s.roundRepeats, [round]: Math.max(1, count) },
    }))

  // --- picker plumbing ---
  const openPickerToAdd = (round: number | null) =>
    setPicker({ open: true, targetRound: round, editingId: null })
  const openPickerToRename = (id: string) =>
    setPicker({ open: true, targetRound: null, editingId: id })
  const onPickerSelect = (name: string) => {
    if (picker.editingId) patchExercise(picker.editingId, { name })
    else addExercise(name, picker.targetRound)
    setPicker({ open: false, targetRound: null, editingId: null })
  }

  // --- save ---
  const onSave = () => {
    setError(null)
    // Scheduling is always Sydney wall-clock time (AEST/AEDT), not whatever
    // timezone the admin's browser/device happens to be set to.
    const scheduledIso =
      publishMode === 'schedule' && scheduledLocal ? localInputToIso(scheduledLocal) : null
    startSaving(async () => {
      const result = init
        ? await updateCoachWorkout(init.workoutId, state, publishMode, scheduledIso)
        : await createCoachWorkout(state, publishMode, scheduledIso)
      if (!result.ok) setError(result.error)
      else {
        router.push('/library')
        router.refresh()
      }
    })
  }

  const validCount = state.exercises.filter((e) => e.name.trim()).length

  const saveLabel = saving
    ? 'Saving…'
    : expandedId !== null
      ? 'Finish editing the exercise first'
      : publishMode === 'draft'
        ? 'Save as draft'
        : publishMode === 'schedule'
          ? 'Schedule workout'
          : `Publish now${validCount > 0 ? ` · ${effectiveDuration(state)} min` : ''}`

  const totalSets =
    state.format === 'Rounds'
      ? state.exercises.reduce((s, e) => s + (e.name.trim() ? e.sets : 0), 0)
      : null

  return (
    <div className="pb-10">
      <h1 className="font-display text-2xl text-ink-900 mb-6">
        {isEditing ? 'Edit workout' : 'New workout'}
      </h1>

      <BuilderShell
        form={
          <div className="space-y-6">
            <FormCard title="Basics">
              {/* Name */}
              <div className="mb-5">
                <SubLabel>Workout name</SubLabel>
                <input
                  type="text"
                  value={state.workoutName}
                  onChange={(e) => set('workoutName', e.target.value)}
                  placeholder="e.g. Full Body Strength"
                  className="w-full rounded-xl border border-line-input bg-surface-input px-4 py-3 font-display text-[22px] font-semibold text-ink-900 placeholder:text-ink-400 placeholder:font-body placeholder:text-sm outline-none focus:border-blush-500 focus:ring-[3px] focus:ring-blush-500/15 transition-colors"
                />
              </div>

              {/* Format chips */}
              <SubLabel>Format</SubLabel>
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 mb-1">
                {BUILDER_FORMAT_ORDER.map((f) => (
                  <Chip key={f} active={state.format === f} onClick={() => set('format', f)}>
                    {FORMAT_CHIP_LABEL[f]}
                  </Chip>
                ))}
              </div>
              <p className="text-xs text-ink-500 mb-5">{FORMAT_DESCRIPTION[state.format]}</p>

              {/* Format settings */}
              <FormatSettings state={state} set={set} onRoundsModeChange={onRoundsModeChange} />

              {/* Estimated time override */}
              <div className="mt-3">
                <DurationOverride state={state} set={set} />
              </div>
            </FormCard>

            <FormCard
              title={state.format === 'Rounds' ? 'Exercises' : 'Each round'}
              action={
                <span className="font-display text-xs text-blush-600 tabular-nums">
                  {liveSummaryText(state)}
                </span>
              }
            >
              {inCustomRounds ? (
                <CustomRoundsSection
                  state={state}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  patchExercise={patchExercise}
                  removeExercise={removeExercise}
                  openPickerToAdd={openPickerToAdd}
                  openPickerToRename={openPickerToRename}
                  setRoundRepeat={setRoundRepeat}
                  addRound={addRound}
                  catalog={exercises}
                />
              ) : (
                <UniformSection
                  state={state}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  patchExercise={patchExercise}
                  removeExercise={removeExercise}
                  openPickerToAdd={openPickerToAdd}
                  openPickerToRename={openPickerToRename}
                  catalog={exercises}
                />
              )}
            </FormCard>

            <FormCard title="Coach details">
              <CoachDetails
                state={state}
                set={set}
                onEquipmentEdited={() => setEquipmentTouched(true)}
                uploadingImage={uploadingImage}
                imageError={imageError}
                onImageChange={onImageChange}
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
              {error && (
                <p className="mt-4 text-sm text-error-text bg-error-tint border border-error-border rounded-card px-4 py-3">
                  {error}
                </p>
              )}
              <button
                onClick={onSave}
                disabled={saving || expandedId !== null || validCount === 0}
                className="mt-4 w-full rounded-pill bg-blush-500 text-white py-3 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow disabled:opacity-50"
              >
                {saveLabel}
              </button>
            </PublishPanel>

            <SummaryCard>
              <SummaryRow label="Format" value={FORMAT_CHIP_LABEL[state.format]} />
              <SummaryRow label="Exercises" value={validCount} />
              {totalSets !== null && <SummaryRow label="Total sets" value={totalSets} />}
              <SummaryRow label="Est. duration" value={`~${effectiveDuration(state)} min`} />
              <SummaryRow label="Equipment" value={state.equipment || '—'} />
            </SummaryCard>
            {!state.imageRef && <WarningStrip>No image set for this workout.</WarningStrip>}
          </>
        }
      />

      {picker.open && (
        <ExercisePicker
          exercises={exercises}
          onSelect={onPickerSelect}
          onClose={() => setPicker({ open: false, targetRound: null, editingId: null })}
          onExerciseCreated={(ex) => setExercises((prev) => [...prev, ex])}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Format settings
// ---------------------------------------------------------------------------

function FormatSettings({
  state,
  set,
  onRoundsModeChange,
}: {
  state: BuilderState
  set: <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => void
  onRoundsModeChange: (custom: boolean) => void
}) {
  if (state.format === 'Rounds') return null

  if (state.format === 'Circuit' || state.format === 'Tabata') {
    return (
      <div className="space-y-3">
        <Segmented
          options={['Same every round', 'Custom rounds']}
          index={state.isCustomRounds ? 1 : 0}
          onChange={(i) => onRoundsModeChange(i === 1)}
        />
        {state.isCustomRounds ? (
          <SettingCard>
            <div className="flex items-center justify-between">
              <Label>Rest between rounds</Label>
              <ChipRow
                values={REST_CHIP_VALUES}
                selected={state.restBetweenRoundsSeconds}
                label={restChipLabel}
                onSelect={(v) => set('restBetweenRoundsSeconds', v)}
              />
            </div>
          </SettingCard>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SettingCard>
              <Label>Rounds</Label>
              <Stepper value={state.rounds} min={1} max={20} onChange={(v) => set('rounds', v)} />
            </SettingCard>
            <SettingCard>
              <Label>Rest between rounds</Label>
              <ChipRow
                values={REST_CHIP_VALUES}
                selected={state.restBetweenRoundsSeconds}
                label={restChipLabel}
                onSelect={(v) => set('restBetweenRoundsSeconds', v)}
              />
            </SettingCard>
          </div>
        )}
      </div>
    )
  }

  if (state.format === 'AMRAP') {
    return (
      <div className="space-y-3">
        <Segmented
          options={['Same every round', 'Custom rounds']}
          index={state.isCustomRounds ? 1 : 0}
          onChange={(i) => onRoundsModeChange(i === 1)}
        />
        <SettingCard>
          <Label>Time cap</Label>
          <Stepper value={state.amrapCapMinutes} min={1} max={60} onChange={(v) => set('amrapCapMinutes', v)} />
        </SettingCard>
      </div>
    )
  }

  if (state.format === 'EMOM') {
    return (
      <div className="space-y-3">
        <Segmented
          options={['Same every minute', 'Custom minutes']}
          index={state.isCustomRounds ? 1 : 0}
          onChange={(i) => onRoundsModeChange(i === 1)}
        />
        <SettingCard>
          <Label>Minutes</Label>
          <Stepper value={state.emomMinutes} min={1} max={60} onChange={(v) => set('emomMinutes', v)} />
        </SettingCard>
      </div>
    )
  }

  // For Time
  return (
    <SettingCard>
      <div className="flex items-center justify-between">
        <Label>Time cap</Label>
        <Toggle checked={state.forTimeCapEnabled} onChange={(v) => set('forTimeCapEnabled', v)} />
      </div>
      {state.forTimeCapEnabled && (
        <div className="mt-3">
          <ChipRow
            values={FOR_TIME_CAP_CHIP_VALUES}
            selected={state.forTimeCapMinutes}
            label={(v) => `${v}`}
            suffix="min"
            onSelect={(v) => set('forTimeCapMinutes', v)}
          />
        </div>
      )}
    </SettingCard>
  )
}

// Manual override for the workout's estimated duration — the reps-based
// auto-estimate (~3s/rep) is sometimes wrong for exercises that are
// reps-labelled but not actually time-proportional. Blank = keep using the
// auto-estimate; a value here wins and is what gets saved/shown in the app.
function DurationOverride({
  state,
  set,
}: {
  state: BuilderState
  set: <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => void
}) {
  const auto = estimatedDuration(state)
  return (
    <SettingCard>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Estimated time (min)</Label>
          <p className="text-xs text-ink-500 mt-0.5">
            Leave blank to use the auto-estimate (~{auto} min).
          </p>
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          placeholder={`${auto}`}
          value={state.durationOverrideMinutes ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            set('durationOverrideMinutes', raw === '' ? null : Math.max(1, parseInt(raw, 10) || 1))
          }}
          className="w-20 rounded-card bg-white shadow-card px-3 py-2 text-sm text-center outline-none focus:ring-1 focus:ring-blush-300"
        />
      </div>
    </SettingCard>
  )
}

// ---------------------------------------------------------------------------
// Exercise sections
// ---------------------------------------------------------------------------

interface ExerciseSectionProps {
  state: BuilderState
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  patchExercise: (id: string, patch: Partial<BuilderExercise>) => void
  removeExercise: (id: string) => void
  openPickerToAdd: (round: number | null) => void
  openPickerToRename: (id: string) => void
  catalog: PickerExercise[]
}

function UniformSection(props: ExerciseSectionProps) {
  const { state } = props
  return (
    <div className="space-y-2">
      {state.exercises.map((ex) => (
        <ExerciseRow key={ex.id} ex={ex} {...props} />
      ))}
      <AddRow label="+ Add exercise" onClick={() => props.openPickerToAdd(null)} dashed />
    </div>
  )
}

function CustomRoundsSection(
  props: ExerciseSectionProps & {
    setRoundRepeat: (round: number, count: number) => void
    addRound: () => void
  }
) {
  const { state } = props
  const rounds = Array.from({ length: Math.max(1, state.customRoundCount) }, (_, i) => i + 1)
  const noun = roundNoun(state.format)
  // Repeating a round N times only makes sense for Circuit/Tabata's
  // fixed-round-count model — EMOM's minutes and AMRAP's rounds each happen
  // exactly once, so there's nothing to repeat.
  const hasRepeatCount = state.format === 'Circuit' || state.format === 'Tabata'
  return (
    <div>
      {rounds.map((round) => (
        <div key={round} className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-blush-600">
              {capitalize(noun)} {round}
            </span>
            {hasRepeatCount && (
              <RoundRepeatStepper
                count={repeatCountFor(state, round)}
                onChange={(v) => props.setRoundRepeat(round, v)}
              />
            )}
          </div>
          <div className="space-y-2">
            {state.exercises
              .filter((e) => e.roundIndex === round)
              .map((ex) => (
                <ExerciseRow key={ex.id} ex={ex} {...props} />
              ))}
            <AddRow
              label={`+ Add to ${noun} ${round}`}
              onClick={() => props.openPickerToAdd(round)}
              dashed
            />
          </div>
        </div>
      ))}
      <AddRow label={`+ Add ${noun}`} onClick={props.addRound} />
    </div>
  )
}

function ExerciseRow({
  ex,
  state,
  expandedId,
  setExpandedId,
  patchExercise,
  removeExercise,
  openPickerToRename,
  catalog,
}: { ex: BuilderExercise } & ExerciseSectionProps) {
  if (expandedId === ex.id) {
    return (
      <ExerciseEditCard
        ex={ex}
        state={state}
        patchExercise={patchExercise}
        removeExercise={removeExercise}
        openPickerToRename={openPickerToRename}
        onDone={() => setExpandedId(null)}
      />
    )
  }
  const catalogEntry = catalog.find((c) => c.name.toLowerCase() === ex.name.trim().toLowerCase())
  const meta = catalogEntry
    ? [catalogEntry.category, catalogEntry.bodyPart].filter(Boolean).join(' · ')
    : null
  return (
    <button
      onClick={() => setExpandedId(ex.id)}
      className="w-full text-left rounded-card border border-line-card bg-white px-4 py-3.5 hover:border-blush-200 hover:bg-surface-header transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-warm text-ink-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
            <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <span className="block font-display text-[15px] text-ink-900 truncate">
            {ex.name || 'Exercise'}
          </span>
          {meta && <span className="block text-xs text-ink-500 truncate mt-0.5">{meta}</span>}
        </div>
        <span className="rounded-pill bg-surface-warm px-3 py-1 text-xs font-medium text-ink-900 tabular-nums shrink-0">
          {quantityPillText(state, ex)}
        </span>
      </div>
      {state.format === 'Rounds' && (
        <div className="mt-1.5 pl-12 text-xs text-ink-500 tabular-nums">
          Rest {formatRowDuration(ex.restSeconds)} between sets
        </div>
      )}
    </button>
  )
}

function ExerciseEditCard({
  ex,
  state,
  patchExercise,
  removeExercise,
  openPickerToRename,
  onDone,
}: {
  ex: BuilderExercise
  state: BuilderState
  patchExercise: (id: string, patch: Partial<BuilderExercise>) => void
  removeExercise: (id: string) => void
  openPickerToRename: (id: string) => void
  onDone: () => void
}) {
  // Tabata stations stay timed-only — no Reps|Time choice, unlike every
  // other format. Per-exercise work/rest durations are still fully
  // editable (see BigStepper/SmallStepper below); only the reps-vs-time
  // mode itself is locked.
  const isTimed = state.format === 'Tabata' ? true : ex.isTimed

  return (
    <div className="rounded-card bg-surface-warm p-4 space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-pill bg-blush-500 shrink-0" />
        <button
          onClick={() => openPickerToRename(ex.id)}
          className="flex-1 flex items-center justify-between border-b border-line-input pb-1 text-left"
        >
          <span
            className={`font-display text-lg truncate ${ex.name ? 'text-ink-900' : 'text-ink-400'}`}
          >
            {ex.name || 'Choose exercise'}
          </span>
          <span className="text-ink-500 text-sm">›</span>
        </button>
        <button
          onClick={() => removeExercise(ex.id)}
          className="text-ink-500 hover:text-error transition-colors"
          aria-label="Remove exercise"
        >
          🗑
        </button>
      </div>

      {state.format !== 'Tabata' && (
        <Segmented
          options={['Reps', 'Time']}
          index={ex.isTimed ? 1 : 0}
          onChange={(i) => patchExercise(ex.id, { isTimed: i === 1 })}
          accent
        />
      )}

      {/* Unit picker: only meaningful for the reps slot. Circuit now saves
          the real authored value/unit (structured fields) instead of forcing
          a seconds conversion, so it gets the same picker as every other
          format. */}
      {!isTimed && (
        <div className="flex gap-2">
          {(['reps', 'calories', 'distance_m'] as ExerciseUnit[]).map((u) => (
            <Chip key={u} active={ex.unit === u} onClick={() => patchExercise(ex.id, { unit: u })}>
              {UNIT_STEPPER[u].label}
            </Chip>
          ))}
        </div>
      )}

      <BigStepper
        value={isTimed ? ex.seconds : ex.reps}
        label={isTimed ? 'Time' : UNIT_STEPPER[ex.unit].label}
        display={isTimed ? formatRowDuration(ex.seconds) : `${ex.reps}`}
        onChange={(v) => patchExercise(ex.id, isTimed ? { seconds: v } : { reps: v })}
        min={isTimed ? 5 : UNIT_STEPPER[ex.unit].min}
        max={isTimed ? 600 : UNIT_STEPPER[ex.unit].max}
        step={isTimed ? 5 : UNIT_STEPPER[ex.unit].step}
      />

      {state.format === 'Rounds' && (
        <div className="grid grid-cols-2 gap-3">
          <SmallStepper
            label="Sets"
            value={ex.sets}
            min={1}
            max={10}
            step={1}
            onChange={(v) => patchExercise(ex.id, { sets: v })}
          />
          <SmallStepper
            label="Rest"
            value={ex.restSeconds}
            min={0}
            max={240}
            step={15}
            display={formatRowDuration(ex.restSeconds)}
            onChange={(v) => patchExercise(ex.id, { restSeconds: v })}
          />
        </div>
      )}

      {state.format === 'Tabata' && (
        <SmallStepper
          label="Rest after this station"
          value={ex.restSeconds}
          min={0}
          max={60}
          step={5}
          display={formatRowDuration(ex.restSeconds)}
          onChange={(v) => patchExercise(ex.id, { restSeconds: v })}
        />
      )}

      <button
        onClick={onDone}
        className="w-full rounded-card bg-ink-900 text-white py-3 text-sm font-medium"
      >
        Done
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Coach metadata
// ---------------------------------------------------------------------------

function CoachDetails({
  state,
  set,
  onEquipmentEdited,
  uploadingImage,
  imageError,
  onImageChange,
}: {
  state: BuilderState
  set: <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => void
  onEquipmentEdited: () => void
  uploadingImage: boolean
  imageError: string | null
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <SubLabel>Image</SubLabel>
        {state.imageRef ? (
          <img
            src={state.imageRef}
            alt=""
            className="w-full h-40 object-cover rounded-card mb-2"
          />
        ) : null}
        <label className="inline-block rounded-pill bg-white border border-line-input px-4 py-2 text-sm font-medium text-ink-900 cursor-pointer hover:bg-surface-warm transition-colors">
          {uploadingImage ? 'Uploading…' : state.imageRef ? 'Replace image' : 'Upload image'}
          <input
            type="file"
            accept="image/*"
            disabled={uploadingImage}
            onChange={onImageChange}
            className="hidden"
          />
        </label>
        {imageError && <p className="text-xs text-error-text mt-2">{imageError}</p>}
      </div>

      <div>
        <SubLabel>Category</SubLabel>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={state.category === c} onClick={() => set('category', c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <SubLabel>Difficulty</SubLabel>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => (
            <Chip key={d} active={state.difficulty === d} onClick={() => set('difficulty', d)}>
              {d}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <SubLabel>Equipment (auto-detected from exercises — edit if needed)</SubLabel>
        <input
          type="text"
          value={state.equipment}
          onChange={(e) => {
            onEquipmentEdited()
            set('equipment', e.target.value)
          }}
          placeholder="e.g. Dumbbells, Mat"
          className="w-full rounded-xl border border-line-input bg-surface-input px-4 py-2.5 text-sm outline-none focus:border-blush-500 focus:ring-[3px] focus:ring-blush-500/15 transition-colors"
        />
      </div>

      <div>
        <SubLabel>Description</SubLabel>
        <textarea
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          placeholder="Short description shown in the app."
          className="w-full rounded-xl border border-line-input bg-surface-input px-4 py-2.5 text-sm outline-none focus:border-blush-500 focus:ring-[3px] focus:ring-blush-500/15 transition-colors resize-none"
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-ink-900">
        <Toggle checked={state.isNew} onChange={(v) => set('isNew', v)} />
        Mark as “New” in the app
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small shared UI
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wider text-ink-300">
      {children}
    </span>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-500 mb-1.5">
      {children}
    </span>
  )
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card bg-surface-warm p-3.5">{children}</div>
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

function ChipRow({
  values,
  selected,
  label,
  suffix,
  onSelect,
}: {
  values: number[]
  selected: number
  label: (v: number) => string
  suffix?: string
  onSelect: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onSelect(v)}
          className={`rounded-pill px-2.5 py-1 text-xs font-medium transition-colors ${
            selected === v ? 'bg-blush-500 text-white' : 'bg-white text-ink-500 hover:bg-surface-warm'
          }`}
        >
          {label(v)}
        </button>
      ))}
      {suffix && <span className="text-xs text-ink-500 px-1">{suffix}</span>}
    </div>
  )
}

function Segmented({
  options,
  index,
  onChange,
  accent,
}: {
  options: [string, string]
  index: number
  onChange: (i: number) => void
  accent?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-card bg-surface-warm p-1">
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(i)}
          className={`rounded-[14px] py-2 text-sm font-medium transition-colors ${
            index === i
              ? accent
                ? 'bg-blush-600 text-white shadow-card'
                : 'bg-white text-ink-900 shadow-card'
              : 'text-ink-500'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between mt-1">
      <CircleButton onClick={() => onChange(Math.max(min, value - 1))}>−</CircleButton>
      <span className="font-display text-xl text-ink-900 tabular-nums">{value}</span>
      <CircleButton onClick={() => onChange(Math.min(max, value + 1))}>+</CircleButton>
    </div>
  )
}

function BigStepper({
  value,
  label,
  display,
  disabled,
  onChange,
  min,
  max,
  step,
}: {
  value: number
  label: string
  display: string
  disabled?: boolean
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <div
      className={`flex items-center justify-center gap-7 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
    >
      <CircleButton big onClick={() => onChange(Math.max(min, value - step))}>
        −
      </CircleButton>
      <div className="text-center min-w-[90px]">
        <div className="font-display text-4xl text-ink-900 tabular-nums leading-none">
          {display}
        </div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-blush-600 mt-1">
          {label}
        </div>
      </div>
      <CircleButton big onClick={() => onChange(Math.min(max, value + step))}>
        +
      </CircleButton>
    </div>
  )
}

function SmallStepper({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-card bg-white/70 py-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wide text-ink-500 mb-1">
        {label}
      </div>
      <div className="flex items-center justify-center gap-2">
        <CircleButton onClick={() => onChange(Math.max(min, value - step))}>−</CircleButton>
        <span className="font-display text-sm text-ink-900 tabular-nums min-w-[2.5rem]">
          {display ?? value}
        </span>
        <CircleButton onClick={() => onChange(Math.min(max, value + step))}>+</CircleButton>
      </div>
    </div>
  )
}

// Round-level repeat control (Task 1): "× N", increment/decrement on tap.
// Min 1 — dropping to 1 just means the round plays once, same as omitting a
// repeat entirely.
function RoundRepeatStepper({
  count,
  onChange,
}: {
  count: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(1, count - 1))}
        aria-label="Repeat round fewer times"
        className="h-5 w-5 grid place-items-center rounded-pill bg-white shadow-card text-ink-900 text-xs"
      >
        −
      </button>
      <span className="text-[11px] font-medium text-ink-500 tabular-nums w-6 text-center">
        × {count}
      </span>
      <button
        onClick={() => onChange(count + 1)}
        aria-label="Repeat round more times"
        className="h-5 w-5 grid place-items-center rounded-pill bg-white shadow-card text-ink-900 text-xs"
      >
        +
      </button>
    </div>
  )
}

function CircleButton({
  onClick,
  big,
  children,
}: {
  onClick: () => void
  big?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`grid place-items-center rounded-pill bg-white shadow-card text-ink-900 font-medium ${
        big ? 'h-10 w-10 text-lg' : 'h-7 w-7 text-sm'
      }`}
    >
      {children}
    </button>
  )
}

function AddRow({
  label,
  onClick,
  dashed,
}: {
  label: string
  onClick: () => void
  dashed?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-card py-3.5 text-sm font-medium text-center transition-colors ${
        dashed
          ? 'border border-dashed border-line-input text-blush-600 hover:bg-surface-warm'
          : 'bg-surface-warm text-ink-900 hover:bg-line-divider'
      }`}
    >
      {label}
    </button>
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
