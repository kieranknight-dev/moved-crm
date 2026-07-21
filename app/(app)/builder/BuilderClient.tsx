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
  CAP_CHIP_VALUES,
  CATEGORIES,
  DIFFICULTIES,
  restChipLabel,
  quantityPillText,
  liveSummaryText,
  estimatedDuration,
  formatRowDuration,
  repeatCountFor,
  type BuilderState,
  type BuilderExercise,
  type PublishMode,
} from '@/lib/builder'
import type { ExerciseCategory } from '@/lib/types'
import { createCoachWorkout, updateCoachWorkout } from './actions'
import { ExercisePicker, type PickerExercise } from './ExercisePicker'
import { PublishPanel } from '@/components/PublishPanel'

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

export interface BuilderInit {
  workoutId: string
  state: BuilderState
  publishMode: PublishMode
  scheduledLocal: string
}

export default function BuilderClient({
  exercises,
  init,
}: {
  exercises: PickerExercise[]
  init?: BuilderInit
}) {
  const router = useRouter()
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

  const set = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const isRoundsMode = state.format === 'Circuit' || state.format === 'Tabata'
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
    const ex = { ...newBuilderExercise(roundIndex), name }
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
    if (custom) enableCustomRounds()
    else if (hasDiscardableRounds) {
      if (confirm('Switching to “Same every round” keeps Round 1’s exercises and discards the rest.'))
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
    // Convert the local datetime-local value to an absolute ISO timestamp here,
    // where the admin's timezone is known — the server must not re-interpret it.
    const scheduledIso =
      publishMode === 'schedule' && scheduledLocal
        ? new Date(scheduledLocal).toISOString()
        : null
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
          : `Publish now${validCount > 0 ? ` · ${estimatedDuration(state)} min` : ''}`

  return (
    <div className="max-w-2xl pb-32">
      <h1 className="font-display text-2xl text-ink-900 mb-6">
        {isEditing ? 'Edit workout' : 'New workout'}
      </h1>

      {/* Name */}
      <input
        type="text"
        value={state.workoutName}
        onChange={(e) => set('workoutName', e.target.value)}
        placeholder="Workout name"
        className="w-full font-display text-2xl text-ink-900 placeholder:text-ink-300 border-b-2 border-blush-100 pb-2 mb-6 outline-none focus:border-blush-500 transition-colors"
      />

      {/* Format chips */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {BUILDER_FORMAT_ORDER.map((f) => (
          <Chip key={f} active={state.format === f} onClick={() => set('format', f)}>
            {FORMAT_CHIP_LABEL[f]}
          </Chip>
        ))}
      </div>
      <p className="text-xs text-ink-500 mt-2 mb-4">{FORMAT_DESCRIPTION[state.format]}</p>

      {/* Format settings */}
      <FormatSettings state={state} set={set} onRoundsModeChange={onRoundsModeChange} />

      {/* Exercises */}
      <div className="mt-6">
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
          />
        )}
      </div>

      {/* Coach details */}
      <CoachDetails state={state} set={set} onEquipmentEdited={() => setEquipmentTouched(true)} />

      {/* Publish */}
      <PublishPanel
        mode={publishMode}
        setMode={setPublishMode}
        scheduledLocal={scheduledLocal}
        setScheduledLocal={setScheduledLocal}
      />

      {/* Save */}
      {error && (
        <p className="mt-6 text-sm text-blush-700 bg-blush-50 border border-blush-100 rounded-card px-4 py-3">
          {error}
        </p>
      )}
      <div className="fixed bottom-0 left-0 right-0 md:left-56 bg-gradient-to-t from-white via-white to-transparent p-6 pt-10">
        <div className="max-w-2xl">
          <button
            onClick={onSave}
            disabled={saving || expandedId !== null || validCount === 0}
            className="w-full rounded-pill bg-blush-500 text-white py-3.5 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>
      </div>

      {picker.open && (
        <ExercisePicker
          exercises={exercises}
          onSelect={onPickerSelect}
          onClose={() => setPicker({ open: false, targetRound: null, editingId: null })}
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
      <SettingCard>
        <Label>Time cap</Label>
        <ChipRow
          values={CAP_CHIP_VALUES}
          selected={state.amrapCapMinutes}
          label={(v) => `${v}`}
          suffix="min"
          onSelect={(v) => set('amrapCapMinutes', v)}
        />
      </SettingCard>
    )
  }

  if (state.format === 'EMOM') {
    return (
      <SettingCard>
        <Label>Minutes</Label>
        <Stepper value={state.emomMinutes} min={1} max={60} onChange={(v) => set('emomMinutes', v)} />
      </SettingCard>
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
            values={CAP_CHIP_VALUES}
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
}

function UniformSection(props: ExerciseSectionProps) {
  const { state } = props
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Label>{state.format === 'Rounds' ? 'Exercises' : 'Each round'}</Label>
        <span className="font-display text-xs text-blush-600 tabular-nums">
          {liveSummaryText(state)}
        </span>
      </div>
      <div className="space-y-2">
        {state.exercises.map((ex) => (
          <ExerciseRow key={ex.id} ex={ex} {...props} />
        ))}
        <AddRow label="+ Add exercise" onClick={() => props.openPickerToAdd(null)} dashed />
      </div>
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
  return (
    <div>
      {rounds.map((round) => (
        <div key={round} className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-blush-600">
              Round {round}
            </span>
            <RoundRepeatStepper
              count={repeatCountFor(state, round)}
              onChange={(v) => props.setRoundRepeat(round, v)}
            />
          </div>
          <div className="space-y-2">
            {state.exercises
              .filter((e) => e.roundIndex === round)
              .map((ex) => (
                <ExerciseRow key={ex.id} ex={ex} {...props} />
              ))}
            <AddRow
              label={`+ Add to round ${round}`}
              onClick={() => props.openPickerToAdd(round)}
              dashed
            />
          </div>
        </div>
      ))}
      <AddRow label="+ Add round" onClick={props.addRound} />
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
  const index = state.exercises.findIndex((e) => e.id === ex.id) + 1
  return (
    <button
      onClick={() => setExpandedId(ex.id)}
      className="w-full text-left rounded-card border border-blush-100 bg-white px-4 py-3.5 hover:border-blush-200 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="w-5 text-center text-xs font-medium text-ink-300">{index}</span>
        <span className="font-display text-[15px] text-ink-900 flex-1 truncate">
          {ex.name || 'Exercise'}
        </span>
        <span className="rounded-pill bg-blush-50 px-3 py-1 text-xs font-medium text-ink-900 tabular-nums">
          {quantityPillText(state, ex)}
        </span>
      </div>
      {state.format === 'Rounds' && (
        <div className="mt-1.5 pl-8 text-xs text-ink-500 tabular-nums">
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
  const isTimed = state.format === 'Tabata' ? true : ex.isTimed
  const disabledBig = state.format === 'Tabata'

  return (
    <div className="rounded-card bg-blush-50 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-pill bg-blush-600 shrink-0" />
        <button
          onClick={() => openPickerToRename(ex.id)}
          className="flex-1 flex items-center justify-between border-b border-blush-600/30 pb-1 text-left"
        >
          <span
            className={`font-display text-lg truncate ${ex.name ? 'text-ink-900' : 'text-ink-300'}`}
          >
            {ex.name || 'Choose exercise'}
          </span>
          <span className="text-blush-600/60 text-sm">›</span>
        </button>
        <button
          onClick={() => removeExercise(ex.id)}
          className="text-blush-600/60 hover:text-blush-700 transition-colors"
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

      <BigStepper
        value={isTimed ? ex.seconds : ex.reps}
        label={isTimed ? 'Time' : 'Reps'}
        display={isTimed ? formatRowDuration(ex.seconds) : `${ex.reps}`}
        disabled={disabledBig}
        onChange={(v) => patchExercise(ex.id, isTimed ? { seconds: v } : { reps: v })}
        min={isTimed ? 5 : 1}
        max={isTimed ? 600 : 100}
        step={isTimed ? 5 : 1}
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
}: {
  state: BuilderState
  set: <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => void
  onEquipmentEdited: () => void
}) {
  return (
    <div className="mt-8 pt-6 border-t border-blush-100 space-y-5">
      <Label>Coach details</Label>

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
          className="w-full rounded-card border border-blush-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-blush-500 transition-colors"
        />
      </div>

      <div>
        <SubLabel>Description</SubLabel>
        <textarea
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          placeholder="Short description shown in the app."
          className="w-full rounded-card border border-blush-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-blush-500 transition-colors resize-none"
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
  return <div className="rounded-card bg-blush-50 p-3.5">{children}</div>
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
      className={`shrink-0 rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-ink-900 text-white' : 'bg-blush-50 text-ink-500 hover:bg-blush-100'
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
            selected === v ? 'bg-blush-500 text-white' : 'bg-white text-ink-500 hover:bg-blush-100'
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
    <div className="grid grid-cols-2 gap-1 rounded-card bg-blush-50 p-1">
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
          ? 'border border-dashed border-blush-200 text-blush-600 hover:bg-blush-50'
          : 'bg-blush-50 text-ink-900 hover:bg-blush-100'
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
      className={`relative h-6 w-10 rounded-pill transition-colors ${checked ? 'bg-blush-500' : 'bg-blush-100'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-pill bg-white shadow-card transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
