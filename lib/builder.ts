// Pure builder logic — a faithful TypeScript port of the iOS
// ManualBuilderState (MOVED/ManualWorkoutBuilder.swift), so the CRM produces
// workouts the app decodes identically. Used by BOTH the live client UI (for
// the running estimate/summary) and the server action (which rebuilds the
// authoritative insert payload server-side — never trusting client columns).
//
// Duration model matches iOS exactly: timed work counts its seconds, reps
// count ~3s each, rests are included.

import type {
  WorkoutFormat,
  WorkoutCategory,
  WorkoutDifficulty,
  WorkoutStatus,
  WorkoutInsert,
  WorkoutRow,
  StructuredExerciseUnit,
} from '@/lib/types'

// How the workout should be published, resolved to concrete status + publish_at
// by resolvePublish() below.
export type PublishMode = 'draft' | 'schedule' | 'publish'

export interface PublishIntent {
  status: WorkoutStatus
  publishAt: string | null // ISO timestamp; null = no scheduled time
}

// One exercise as the app stores it inside workouts.exercises (JSONB).
// Matches the Swift Exercise struct's CodingKeys; nil/undefined fields are
// omitted, which the app's decoder tolerates (it decodes each with try?).
export interface WorkoutExercisePayload {
  id: string
  name: string
  detail: string
  value?: number
  unit?: StructuredExerciseUnit
  rest_seconds?: number
  sets?: number
  rest_after_sets_seconds?: number
  round_index?: number
}

// Reps|Time chooses the STORAGE shape (a number vs. a duration); unit only
// applies to the reps side and chooses what that number counts. No new
// stored column: like isTimed itself, it's encoded straight into the
// `detail` display string ("15 cal", "500 m") and reparsed on edit — the same
// convention the app already uses for reps vs. seconds, so it needs no
// schema change and decodes identically on iOS's existing detail parser.
export type ExerciseUnit = 'reps' | 'calories' | 'distance_m'

export interface BuilderExercise {
  id: string
  name: string
  // Both values persist independently of the Reps|Time toggle, matching iOS —
  // flipping the toggle never loses the other one's value.
  isTimed: boolean
  reps: number
  seconds: number
  unit: ExerciseUnit // meaningful only when !isTimed
  sets: number // Rounds ("Strength") only
  restSeconds: number // Rounds only — rest between sets
  roundIndex: number | null // Circuit/Tabata custom-rounds tag (1-based); null = uniform
}

export interface BuilderState {
  workoutName: string
  format: WorkoutFormat

  // Circuit / Tabata
  isCustomRounds: boolean
  rounds: number
  restBetweenRoundsSeconds: number
  customRoundCount: number
  // Authoring-time only, keyed by round number (1-based); missing = 1. Matches
  // iOS's GigiRound.repeatCount convention (Models/GigiModels.swift) — a round
  // repeated N times is expanded into N consecutive physical round_index blocks
  // at save time (see buildInsert), since the flat exercises[] model has no
  // separate repeat-count concept of its own.
  roundRepeats: Record<number, number>

  // AMRAP / For Time
  amrapCapMinutes: number
  forTimeCapEnabled: boolean
  forTimeCapMinutes: number

  // EMOM
  emomMinutes: number

  exercises: BuilderExercise[]

  // Manual override for the workout's duration (minutes), shown/saved in
  // place of the auto-estimate computed from the exercises below — the
  // reps-based estimate (~3s/rep) is sometimes wrong for exercises that are
  // reps-labelled but not actually time-proportional. null = no override,
  // use estimatedDuration(state) as before.
  durationOverrideMinutes: number | null

  // Coach metadata (CRM-only — iOS hardcodes these for user workouts).
  category: WorkoutCategory
  difficulty: WorkoutDifficulty
  description: string
  equipment: string
  isNew: boolean
  // Public URL in the workout-images bucket (Task 3); null = no image. Same
  // column iOS already reads via Workout.imageURL (Models/Workout.swift).
  imageRef: string | null
}

// ---------------------------------------------------------------------------
// Format metadata (ported from chipLabel / chipDescription / order in Swift).
// NOTE: the 'Rounds' format is labelled "Strength" in the builder UI — a MOVED
// convention. The raw value saved to the DB is still 'Rounds'.
// ---------------------------------------------------------------------------

export const BUILDER_FORMAT_ORDER: WorkoutFormat[] = [
  'Rounds',
  'Circuit',
  'AMRAP',
  'EMOM',
  'Tabata',
  'For Time',
]

export const FORMAT_CHIP_LABEL: Record<WorkoutFormat, string> = {
  Rounds: 'Strength',
  Circuit: 'Circuit',
  AMRAP: 'AMRAP',
  EMOM: 'EMOM',
  Tabata: 'Tabata',
  'For Time': 'For time',
}

export const FORMAT_DESCRIPTION: Record<WorkoutFormat, string> = {
  Rounds: 'Sets × reps · rest timer between sets',
  Circuit: 'Timed stations · set number of rounds',
  AMRAP: 'As many rounds as possible in a time block',
  EMOM: 'Every minute on the minute',
  Tabata: '20s work · 10s rest, repeated',
  'For Time': 'Complete the work as fast as possible',
}

export const REST_CHIP_VALUES = [0, 30, 60, 120]
export const CAP_CHIP_VALUES = [8, 10, 12, 15, 20]
export const FOR_TIME_CAP_CHIP_VALUES = [8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]

export const CATEGORIES: WorkoutCategory[] = [
  'Strength',
  'HIIT',
  'Conditioning',
  'Mobility',
  'Full Body',
  'Upper Body',
  'Lower Body',
]

export const DIFFICULTIES: WorkoutDifficulty[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
]

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function newBuilderExercise(roundIndex: number | null = null): BuilderExercise {
  return {
    id: crypto.randomUUID(),
    name: '',
    isTimed: false,
    reps: 10,
    seconds: 30,
    unit: 'reps',
    sets: 3,
    restSeconds: 45,
    roundIndex,
  }
}

// Step/range per unit for the shared reps-slot stepper (Task 1).
export const UNIT_STEPPER: Record<ExerciseUnit, { label: string; min: number; max: number; step: number }> = {
  reps: { label: 'Reps', min: 1, max: 100, step: 1 },
  calories: { label: 'Cal', min: 5, max: 200, step: 5 },
  distance_m: { label: 'Distance (m)', min: 10, max: 2000, step: 10 },
}

export function initialBuilderState(): BuilderState {
  return {
    workoutName: '',
    format: 'Rounds',
    isCustomRounds: false,
    rounds: 3,
    restBetweenRoundsSeconds: 0,
    customRoundCount: 1,
    roundRepeats: {},
    amrapCapMinutes: 12,
    forTimeCapEnabled: false,
    forTimeCapMinutes: 15,
    emomMinutes: 10,
    exercises: [],
    durationOverrideMinutes: null,
    category: 'Full Body',
    difficulty: 'Intermediate',
    description: '',
    equipment: '',
    isNew: true,
    imageRef: null,
  }
}

// Repeat count for an authored round (1-based); missing = 1, matching iOS's
// GigiRound decode fallback.
export function repeatCountFor(state: BuilderState, round: number): number {
  return Math.max(1, state.roundRepeats[round] ?? 1)
}

// Total physical round count once repeats are expanded — mirrors iOS's
// GigiWorkout.asWorkout() physicalRoundCount accumulation.
function physicalRoundCount(state: BuilderState): number {
  const authored = Math.max(1, maxRoundIndex(state.exercises))
  let total = 0
  for (let r = 1; r <= authored; r++) total += repeatCountFor(state, r)
  return total
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

// "%d:%02d" — matches iOS formatRowDuration (e.g. 45 → "0:45", 90 → "1:30").
export function formatRowDuration(seconds: number): string {
  const s = Math.max(0, seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function workSeconds(ex: BuilderExercise): number {
  return ex.isTimed ? ex.seconds : ex.reps * 3
}

function maxRoundIndex(exercises: BuilderExercise[]): number {
  return exercises.reduce((m, ex) => Math.max(m, ex.roundIndex ?? 0), 0)
}

export function roundCountFor(state: BuilderState): number {
  if (state.format !== 'Circuit' && state.format !== 'Tabata') return 1
  return state.isCustomRounds ? physicalRoundCount(state) : state.rounds
}

// Unit suffix for the reps-slot value ("12", "15 cal", "500 m") — Circuit
// never shows this (its reps entry always converts to a station duration
// instead, so it stays plain regardless of `unit`).
function repsQuantityText(ex: BuilderExercise): string {
  switch (ex.unit) {
    case 'calories':
      return `${ex.reps} cal`
    case 'distance_m':
      return `${ex.reps} m`
    default:
      return `${ex.reps}`
  }
}

export function quantityPillText(state: BuilderState, ex: BuilderExercise): string {
  switch (state.format) {
    case 'Tabata':
      return '0:20'
    case 'Rounds': {
      const qty = ex.isTimed ? formatRowDuration(ex.seconds) : repsQuantityText(ex)
      return `${ex.sets} × ${qty}`
    }
    default:
      return ex.isTimed ? formatRowDuration(ex.seconds) : repsQuantityText(ex)
  }
}

export function restChipLabel(seconds: number): string {
  if (seconds === 0) return 'Off'
  return seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`
}

export function estimatedDuration(state: BuilderState): number {
  const { exercises } = state
  switch (state.format) {
    case 'Rounds': {
      const total = exercises.reduce((sum, ex) => {
        const perSet = workSeconds(ex)
        return sum + ex.sets * perSet + Math.max(0, ex.sets - 1) * ex.restSeconds
      }, 0)
      return Math.max(1, Math.floor(total / 60))
    }
    case 'AMRAP':
      return state.amrapCapMinutes
    case 'For Time': {
      if (state.forTimeCapEnabled) return state.forTimeCapMinutes
      const total = exercises.reduce((s, ex) => s + workSeconds(ex), 0)
      return Math.max(1, Math.floor(total / 60))
    }
    case 'EMOM':
      return state.emomMinutes
    case 'Tabata': {
      if (state.isCustomRounds) {
        const authored = Math.max(1, maxRoundIndex(exercises))
        let stationSeconds = 0
        for (let r = 1; r <= authored; r++) {
          const perRound = exercises.filter((ex) => ex.roundIndex === r).length
          if (perRound > 0) stationSeconds += (perRound * 30 - 10) * repeatCountFor(state, r)
        }
        const physical = physicalRoundCount(state)
        const total = stationSeconds + Math.max(0, physical - 1) * state.restBetweenRoundsSeconds
        return Math.max(1, Math.floor(total / 60))
      }
      const roundCount = state.rounds
      const perRound = exercises.length
      if (perRound <= 0) return 1
      const perRoundSeconds = perRound * 30 - 10
      const total =
        roundCount * perRoundSeconds + Math.max(0, roundCount - 1) * state.restBetweenRoundsSeconds
      return Math.max(1, Math.floor(total / 60))
    }
    case 'Circuit': {
      if (exercises.length === 0) return 1
      if (state.isCustomRounds) {
        const authored = Math.max(1, maxRoundIndex(exercises))
        let stationSeconds = 0
        for (let r = 1; r <= authored; r++) {
          const roundSeconds = exercises
            .filter((ex) => ex.roundIndex === r)
            .reduce((s, ex) => s + workSeconds(ex), 0)
          stationSeconds += roundSeconds * repeatCountFor(state, r)
        }
        const physical = physicalRoundCount(state)
        return Math.max(
          1,
          Math.floor(
            (stationSeconds + Math.max(0, physical - 1) * state.restBetweenRoundsSeconds) / 60
          )
        )
      }
      const roundCount = state.rounds
      const perRoundSeconds = exercises.reduce((s, ex) => s + workSeconds(ex), 0)
      const total =
        roundCount * perRoundSeconds + Math.max(0, roundCount - 1) * state.restBetweenRoundsSeconds
      return Math.max(1, Math.floor(total / 60))
    }
  }
}

// The workout's actual duration: the admin's manual override if one is set,
// otherwise the auto-estimate computed from the authored exercises. This is
// what gets saved to workouts.duration and shown everywhere in the builder.
export function effectiveDuration(state: BuilderState): number {
  return state.durationOverrideMinutes ?? estimatedDuration(state)
}

export function liveSummaryText(state: BuilderState): string {
  const { exercises } = state
  const overridden = state.durationOverrideMinutes != null
  switch (state.format) {
    case 'Rounds': {
      const totalSets = exercises.reduce((s, ex) => s + ex.sets, 0)
      const base = `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${totalSets} sets`
      return overridden ? `${base} · ${effectiveDuration(state)} min` : base
    }
    case 'AMRAP':
      return formatRowDuration(state.amrapCapMinutes * 60)
    case 'For Time':
      if (overridden) return `${effectiveDuration(state)} min`
      return state.forTimeCapEnabled
        ? `cap ${state.forTimeCapMinutes} min`
        : `~${estimatedDuration(state)} min`
    case 'EMOM':
      return `${state.emomMinutes} min · ~${exercises.length} exercises`
    case 'Tabata':
    case 'Circuit':
      return overridden
        ? `×${roundCountFor(state)} rounds · ${effectiveDuration(state)} min`
        : `×${roundCountFor(state)} rounds · ~${estimatedDuration(state)} min`
  }
}

// "12 reps" / "15 cal" / "500 m" — the exact suffix iOS's parseExerciseDetail
// (WorkoutStepSequenceGenerators.swift) looks for to reconstruct the unit.
function unitDetailText(ex: BuilderExercise): string {
  switch (ex.unit) {
    case 'calories':
      return `${ex.reps} cal`
    case 'distance_m':
      return `${ex.reps} m`
    default:
      return `${ex.reps} reps`
  }
}

function detailText(state: BuilderState, ex: BuilderExercise): string {
  switch (state.format) {
    case 'Tabata':
      return '20 sec'
    default:
      // Circuit used to force every station onto a ~3s/rep seconds conversion
      // here (workSeconds), discarding the authored reps/cal/distance value —
      // that mismatch is exactly the bug the structured value/unit/rest_seconds
      // fields (see toPayload below) fix. detail is now always a faithful
      // projection of the actual authored value, same as every other format.
      return ex.isTimed ? `${ex.seconds} sec` : unitDetailText(ex)
  }
}

// Structured value for a Circuit exercise — the source of truth going
// forward; `detail` above is derived from the same isTimed/reps/seconds/unit
// state, so the two can never disagree the way the old forced-seconds
// conversion could.
function structuredValue(ex: BuilderExercise): { value: number; unit: StructuredExerciseUnit } {
  return ex.isTimed ? { value: ex.seconds, unit: 'seconds' } : { value: ex.reps, unit: ex.unit }
}

// ---------------------------------------------------------------------------
// Build the authoritative insert payload. Coach content: user_id NULL,
// source 'coach', not shared/favourited. Called server-side by the action.
// ---------------------------------------------------------------------------

// Resolves a publish choice into concrete column values. `scheduledAt` is
// required (and must be in the future) only for 'schedule'.
export function resolvePublish(
  mode: PublishMode,
  scheduledAt: string | null
): PublishIntent | { error: string } {
  switch (mode) {
    case 'draft':
      return { status: 'draft', publishAt: null }
    case 'publish':
      return { status: 'published', publishAt: new Date().toISOString() }
    case 'schedule': {
      if (!scheduledAt) return { error: 'Pick a date and time to schedule.' }
      const when = new Date(scheduledAt)
      if (Number.isNaN(when.getTime())) return { error: 'That schedule time isn’t valid.' }
      if (when.getTime() <= Date.now())
        return { error: 'Scheduled time must be in the future.' }
      return { status: 'scheduled', publishAt: when.toISOString() }
    }
  }
}

export function buildInsert(state: BuilderState, publish: PublishIntent): WorkoutInsert {
  const isCustomRoundsFormat =
    state.isCustomRounds && (state.format === 'Circuit' || state.format === 'Tabata')

  const valid = state.exercises.filter((ex) => ex.name.trim().length > 0)

  const toPayload = (ex: BuilderExercise, roundIndex: number | null | undefined): WorkoutExercisePayload => {
    const payload: WorkoutExercisePayload = {
      id: ex.id,
      name: ex.name.trim(),
      detail: detailText(state, ex),
    }
    if (state.format === 'Rounds') {
      payload.sets = ex.sets
      payload.rest_after_sets_seconds = ex.restSeconds
    }
    if (state.format === 'Circuit') {
      // Structured fields are the source of truth for Circuit going forward
      // (detail above is only a derived projection for legacy/back-compat
      // readers). No per-exercise rest input exists in the builder yet, so
      // rest_seconds stays unset — a future feature's natural home.
      const sv = structuredValue(ex)
      payload.value = sv.value
      payload.unit = sv.unit
    }
    if (isCustomRoundsFormat && roundIndex != null) {
      payload.round_index = roundIndex
    }
    return payload
  }

  // Expand each authored round's repeatCount into that many consecutive
  // physical round_index blocks — the flat exercises[] model has no separate
  // repeat-count concept, exactly like iOS's GigiWorkout.asWorkout() (same id
  // reused across repeated instances, matching that convention).
  let exercises: WorkoutExercisePayload[]
  if (isCustomRoundsFormat) {
    const authored = Math.max(1, maxRoundIndex(valid))
    exercises = []
    let physical = 0
    for (let r = 1; r <= authored; r++) {
      const roundExercises = valid.filter((ex) => ex.roundIndex === r)
      const repeat = repeatCountFor(state, r)
      for (let i = 0; i < repeat; i++) {
        physical += 1
        for (const ex of roundExercises) exercises.push(toPayload(ex, physical))
      }
    }
  } else {
    exercises = valid.map((ex) => toPayload(ex, ex.roundIndex))
  }

  const title = state.workoutName.trim() || `${FORMAT_CHIP_LABEL[state.format]} Workout`
  const rounds = roundCountFor(state)
  const duration = effectiveDuration(state)

  const insert: WorkoutInsert = {
    user_id: null,
    title,
    duration,
    difficulty: state.difficulty,
    category: state.category,
    source: 'coach',
    is_new: state.isNew,
    is_favorited: false,
    is_shared: false,
    posted_ago: postedAgoFor(publish),
    description: state.description.trim(),
    equipment: state.equipment.trim(),
    image_ref: state.imageRef,
    format: state.format,
    rounds,
    status: publish.status,
    publish_at: publish.publishAt,
    exercises: exercises as unknown as WorkoutInsert['exercises'],
    rest_between_rounds_seconds:
      state.format === 'Circuit' || state.format === 'Tabata'
        ? state.restBetweenRoundsSeconds
        : null,
    for_time_cap_seconds:
      state.format === 'For Time' && state.forTimeCapEnabled
        ? state.forTimeCapMinutes * 60
        : null,
  }

  return insert
}

// Replaces the old manual "posted" text input: the label reflects the actual
// moment the workout goes live to the community feed (publish_at), not a
// typed-in guess. Drafts/scheduled workouts aren't live yet, so there's
// nothing to post — nil hides the "posted" row in the app (same as today).
// Matches the existing app convention of a short relative string ("1d ago"),
// e.g. from Models/Workout.swift's sample data.
function postedAgoFor(publish: PublishIntent): string | null {
  if (publish.status !== 'published' || !publish.publishAt) return null
  return formatPostedAgo(publish.publishAt)
}

export function formatPostedAgo(publishAtIso: string): string {
  const ms = Date.now() - new Date(publishAtIso).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ---------------------------------------------------------------------------
// Reverse conversion — reopen an existing workout in the builder (edit mode).
// Best-effort: the builder's model is simpler than a free-form `detail`, so
// CRM-created workouts round-trip cleanly, but legacy/app-authored details
// like "10 reps each side" collapse to their leading number.
// ---------------------------------------------------------------------------

function parseDetail(
  detail: string
): { isTimed: boolean; reps: number; seconds: number; unit: ExerciseUnit } {
  const sec = detail.match(/(\d+)\s*sec/i)
  if (sec) return { isTimed: true, reps: 10, seconds: parseInt(sec[1], 10), unit: 'reps' }
  const cal = detail.match(/(\d+)\s*cal/i)
  if (cal) return { isTimed: false, reps: parseInt(cal[1], 10), seconds: 30, unit: 'calories' }
  const dist = detail.match(/(\d+)\s*m\b/i)
  if (dist) return { isTimed: false, reps: parseInt(dist[1], 10), seconds: 30, unit: 'distance_m' }
  const rep = detail.match(/(\d+)\s*rep/i)
  if (rep) return { isTimed: false, reps: parseInt(rep[1], 10), seconds: 30, unit: 'reps' }
  const num = detail.match(/(\d+)/)
  return { isTimed: false, reps: num ? parseInt(num[1], 10) : 10, seconds: 30, unit: 'reps' }
}

// Columns builderStateFromWorkout needs. WorkoutRow has all of them (plus more).
type WorkoutForEdit = Pick<
  WorkoutRow,
  | 'title'
  | 'duration'
  | 'difficulty'
  | 'category'
  | 'format'
  | 'rounds'
  | 'exercises'
  | 'rest_between_rounds_seconds'
  | 'for_time_cap_seconds'
  | 'description'
  | 'equipment'
  | 'is_new'
  | 'image_ref'
>

export function builderStateFromWorkout(w: WorkoutForEdit): BuilderState {
  const format = w.format as WorkoutFormat
  const raw = Array.isArray(w.exercises) ? (w.exercises as Record<string, unknown>[]) : []
  const isRoundsFmt = format === 'Circuit' || format === 'Tabata'
  const isCustomRounds = isRoundsFmt && raw.some((e) => typeof e?.round_index === 'number')

  const rawExercises: BuilderExercise[] = raw.map((e) => {
    // Circuit: prefer the structured fields (source of truth) over reparsing
    // detail text — falls back to detail-parsing only for rows saved before
    // the 2026-07-23 migration, which never got value/unit backfilled.
    const structured =
      format === 'Circuit' && typeof e?.value === 'number' && typeof e?.unit === 'string'
        ? (e.unit === 'seconds'
            ? { isTimed: true, reps: 10, seconds: e.value, unit: 'reps' as const }
            : { isTimed: false, reps: e.value, seconds: 30, unit: e.unit as ExerciseUnit })
        : null
    const d = structured ?? parseDetail(String(e?.detail ?? ''))
    return {
      // Always fresh: a repeated round (see buildInsert) reuses the same id
      // across its physical round_index copies, which would otherwise produce
      // duplicate React keys once reopened in the builder.
      id: crypto.randomUUID(),
      name: String(e?.name ?? ''),
      isTimed: format === 'Tabata' ? true : d.isTimed,
      reps: d.reps,
      seconds: format === 'Tabata' ? 20 : d.seconds,
      unit: d.unit,
      sets: typeof e?.sets === 'number' ? e.sets : 3,
      restSeconds: typeof e?.rest_after_sets_seconds === 'number' ? e.rest_after_sets_seconds : 45,
      roundIndex: typeof e?.round_index === 'number' ? e.round_index : null,
    }
  })

  // Storage has no separate repeat-count concept (see buildInsert) — a round
  // that was saved as ×3 comes back as 3 consecutive physical round_index
  // blocks with identical exercises. Detect and collapse those runs back into
  // one authored round + repeatCount, so reopening a repeated round doesn't
  // dump it out as N duplicate round cards.
  let exercises = rawExercises
  let customRoundCount = Math.max(1, rawExercises.reduce((m, e) => Math.max(m, e.roundIndex ?? 0), 0))
  const roundRepeats: Record<number, number> = {}

  if (isCustomRounds) {
    const signature = (exs: BuilderExercise[]) =>
      JSON.stringify(
        exs.map((e) => ({ name: e.name, isTimed: e.isTimed, reps: e.reps, seconds: e.seconds, unit: e.unit }))
      )

    const physicalRounds: BuilderExercise[][] = []
    for (let r = 1; r <= customRoundCount; r++) {
      physicalRounds.push(rawExercises.filter((e) => e.roundIndex === r))
    }

    const collapsed: { exercises: BuilderExercise[]; repeat: number }[] = []
    for (const round of physicalRounds) {
      const prev = collapsed[collapsed.length - 1]
      if (prev && signature(prev.exercises) === signature(round)) prev.repeat += 1
      else collapsed.push({ exercises: round, repeat: 1 })
    }

    const finalExercises: BuilderExercise[] = []
    collapsed.forEach((c, i) => {
      const roundNum = i + 1
      roundRepeats[roundNum] = c.repeat
      for (const e of c.exercises) finalExercises.push({ ...e, roundIndex: roundNum })
    })
    exercises = finalExercises
    customRoundCount = collapsed.length
  }

  const base: BuilderState = {
    workoutName: w.title ?? '',
    format,
    isCustomRounds,
    rounds: w.rounds ?? 3,
    restBetweenRoundsSeconds: w.rest_between_rounds_seconds ?? 0,
    customRoundCount,
    roundRepeats,
    amrapCapMinutes: format === 'AMRAP' ? (w.duration ?? 12) : 12,
    forTimeCapEnabled: format === 'For Time' && w.for_time_cap_seconds != null,
    forTimeCapMinutes:
      w.for_time_cap_seconds != null ? Math.round(w.for_time_cap_seconds / 60) : 15,
    emomMinutes: format === 'EMOM' ? (w.duration ?? 10) : 10,
    exercises,
    durationOverrideMinutes: null,
    category: w.category as WorkoutCategory,
    difficulty: w.difficulty as WorkoutDifficulty,
    description: w.description ?? '',
    equipment: w.equipment ?? '',
    isNew: !!w.is_new,
    imageRef: w.image_ref ?? null,
  }

  // No separate "was this overridden" column — infer it: if the saved
  // duration doesn't match what the auto-estimate would produce from the
  // reconstructed state, the admin must have typed a manual value, so prefill
  // the override with the saved duration rather than silently losing it.
  const auto = estimatedDuration(base)
  const durationOverrideMinutes =
    w.duration != null && w.duration !== auto ? w.duration : null

  return { ...base, durationOverrideMinutes }
}

// MOVED. is an Australian app — scheduling is always anchored to Sydney wall
// clock time (AEST/AEDT, DST-aware via Intl), regardless of what timezone the
// admin's own browser/device happens to be set to. Previously this used the
// browser's ambient local timezone (native Date getters/`new Date(string)`),
// which silently scheduled at the wrong instant on any machine not itself set
// to an Australian zone.
const SCHEDULING_TIME_ZONE = 'Australia/Sydney'

const schedulingFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHEDULING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function schedulingParts(d: Date) {
  const parts = schedulingFormatter.formatToParts(d)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  // Some environments report midnight as hour '24' with hour12: false.
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

// Sydney wall-clock "YYYY-MM-DDTHH:mm" for a datetime-local input, from an
// absolute ISO timestamp — the inverse of localInputToIso below.
export function isoToLocalInput(iso: string): string {
  const p = schedulingParts(new Date(iso))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

// Converts a datetime-local input value ("YYYY-MM-DDTHH:mm"), interpreted as
// Sydney wall-clock time, to an absolute ISO instant. Uses the standard
// "guess UTC, measure the zone's actual offset at that instant, correct"
// approach so AEST/AEDT (DST) is handled correctly without a timezone library.
export function localInputToIso(local: string): string {
  const [datePart, timePart] = local.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)

  const guess = Date.UTC(y, mo - 1, d, h, mi, 0)
  const p = schedulingParts(new Date(guess))
  const wallInZoneAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const offsetMs = wallInZoneAsUtc - guess

  return new Date(guess - offsetMs).toISOString()
}

// Initial publish selector state when editing an existing workout.
export function publishInitFromStatus(
  status: string,
  publishAt: string | null
): { mode: PublishMode; scheduledLocal: string } {
  if (status === 'scheduled' && publishAt) {
    return { mode: 'schedule', scheduledLocal: isoToLocalInput(publishAt) }
  }
  if (status === 'published') return { mode: 'publish', scheduledLocal: '' }
  // draft or archived → editing lands in draft mode
  return { mode: 'draft', scheduledLocal: '' }
}
