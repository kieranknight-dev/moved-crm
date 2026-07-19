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
  sets?: number
  rest_after_sets_seconds?: number
  round_index?: number
}

export interface BuilderExercise {
  id: string
  name: string
  // Both values persist independently of the Reps|Time toggle, matching iOS —
  // flipping the toggle never loses the other one's value.
  isTimed: boolean
  reps: number
  seconds: number
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

  // AMRAP / For Time
  amrapCapMinutes: number
  forTimeCapEnabled: boolean
  forTimeCapMinutes: number

  // EMOM
  emomMinutes: number

  exercises: BuilderExercise[]

  // Coach metadata (CRM-only — iOS hardcodes these for user workouts).
  category: WorkoutCategory
  difficulty: WorkoutDifficulty
  description: string
  equipment: string
  isNew: boolean
  postedAgo: string
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

export const CATEGORIES: WorkoutCategory[] = [
  'Strength',
  'HIIT',
  'Conditioning',
  'Mobility',
  'Full Body',
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
    sets: 3,
    restSeconds: 45,
    roundIndex,
  }
}

export function initialBuilderState(): BuilderState {
  return {
    workoutName: '',
    format: 'Rounds',
    isCustomRounds: false,
    rounds: 3,
    restBetweenRoundsSeconds: 0,
    customRoundCount: 1,
    amrapCapMinutes: 12,
    forTimeCapEnabled: false,
    forTimeCapMinutes: 15,
    emomMinutes: 10,
    exercises: [],
    category: 'Full Body',
    difficulty: 'Intermediate',
    description: '',
    equipment: '',
    isNew: true,
    postedAgo: '',
  }
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
  return state.isCustomRounds ? Math.max(1, maxRoundIndex(state.exercises)) : state.rounds
}

export function quantityPillText(state: BuilderState, ex: BuilderExercise): string {
  switch (state.format) {
    case 'Tabata':
      return '0:20'
    case 'Rounds': {
      const qty = ex.isTimed ? formatRowDuration(ex.seconds) : `${ex.reps}`
      return `${ex.sets} × ${qty}`
    }
    default:
      return ex.isTimed ? formatRowDuration(ex.seconds) : `×${ex.reps}`
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
      const roundCount = state.isCustomRounds ? Math.max(1, maxRoundIndex(exercises)) : state.rounds
      const perRound = state.isCustomRounds
        ? Math.floor(exercises.length / Math.max(1, roundCount))
        : exercises.length
      if (perRound <= 0) return 1
      const perRoundSeconds = perRound * 30 - 10
      const total =
        roundCount * perRoundSeconds + Math.max(0, roundCount - 1) * state.restBetweenRoundsSeconds
      return Math.max(1, Math.floor(total / 60))
    }
    case 'Circuit': {
      if (exercises.length === 0) return 1
      const roundCount = state.isCustomRounds ? Math.max(1, maxRoundIndex(exercises)) : state.rounds
      if (state.isCustomRounds) {
        let stationSeconds = 0
        for (let r = 1; r <= roundCount; r++) {
          stationSeconds += exercises
            .filter((ex) => ex.roundIndex === r)
            .reduce((s, ex) => s + workSeconds(ex), 0)
        }
        return Math.max(
          1,
          Math.floor(
            (stationSeconds + Math.max(0, roundCount - 1) * state.restBetweenRoundsSeconds) / 60
          )
        )
      }
      const perRoundSeconds = exercises.reduce((s, ex) => s + workSeconds(ex), 0)
      const total =
        roundCount * perRoundSeconds + Math.max(0, roundCount - 1) * state.restBetweenRoundsSeconds
      return Math.max(1, Math.floor(total / 60))
    }
  }
}

export function liveSummaryText(state: BuilderState): string {
  const { exercises } = state
  switch (state.format) {
    case 'Rounds': {
      const totalSets = exercises.reduce((s, ex) => s + ex.sets, 0)
      return `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} · ${totalSets} sets`
    }
    case 'AMRAP':
      return formatRowDuration(state.amrapCapMinutes * 60)
    case 'For Time':
      return state.forTimeCapEnabled
        ? `cap ${state.forTimeCapMinutes} min`
        : `~${estimatedDuration(state)} min`
    case 'EMOM':
      return `${state.emomMinutes} min · ~${exercises.length} exercises`
    case 'Tabata':
    case 'Circuit':
      return `×${roundCountFor(state)} rounds · ~${estimatedDuration(state)} min`
  }
}

function detailText(state: BuilderState, ex: BuilderExercise): string {
  switch (state.format) {
    case 'Circuit':
      // Circuit stations are clock-driven: a reps choice is converted to its
      // ~3s/rep time equivalent so the generated station length stays coherent.
      return `${workSeconds(ex)} sec`
    case 'Tabata':
      return '20 sec'
    default:
      return ex.isTimed ? `${ex.seconds} sec` : `${ex.reps} reps`
  }
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

  const exercises: WorkoutExercisePayload[] = valid.map((ex) => {
    const payload: WorkoutExercisePayload = {
      id: ex.id,
      name: ex.name.trim(),
      detail: detailText(state, ex),
    }
    if (state.format === 'Rounds') {
      payload.sets = ex.sets
      payload.rest_after_sets_seconds = ex.restSeconds
    }
    if (isCustomRoundsFormat && ex.roundIndex != null) {
      payload.round_index = ex.roundIndex
    }
    return payload
  })

  const title = state.workoutName.trim() || `${FORMAT_CHIP_LABEL[state.format]} Workout`
  const rounds = roundCountFor(state)
  const duration = state.format === 'EMOM' ? state.emomMinutes : estimatedDuration(state)

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
    posted_ago: state.postedAgo.trim() || null,
    description: state.description.trim(),
    equipment: state.equipment.trim(),
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

// ---------------------------------------------------------------------------
// Reverse conversion — reopen an existing workout in the builder (edit mode).
// Best-effort: the builder's model is simpler than a free-form `detail`, so
// CRM-created workouts round-trip cleanly, but legacy/app-authored details
// like "10 reps each side" collapse to their leading number.
// ---------------------------------------------------------------------------

function parseDetail(detail: string): { isTimed: boolean; reps: number; seconds: number } {
  const sec = detail.match(/(\d+)\s*sec/i)
  if (sec) return { isTimed: true, reps: 10, seconds: parseInt(sec[1], 10) }
  const rep = detail.match(/(\d+)\s*rep/i)
  if (rep) return { isTimed: false, reps: parseInt(rep[1], 10), seconds: 30 }
  const num = detail.match(/(\d+)/)
  return { isTimed: false, reps: num ? parseInt(num[1], 10) : 10, seconds: 30 }
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
  | 'posted_ago'
>

export function builderStateFromWorkout(w: WorkoutForEdit): BuilderState {
  const format = w.format as WorkoutFormat
  const raw = Array.isArray(w.exercises) ? (w.exercises as Record<string, unknown>[]) : []
  const isRoundsFmt = format === 'Circuit' || format === 'Tabata'
  const isCustomRounds = isRoundsFmt && raw.some((e) => typeof e?.round_index === 'number')

  const exercises: BuilderExercise[] = raw.map((e) => {
    const d = parseDetail(String(e?.detail ?? ''))
    return {
      id: typeof e?.id === 'string' ? e.id : crypto.randomUUID(),
      name: String(e?.name ?? ''),
      isTimed: format === 'Tabata' ? true : d.isTimed,
      reps: d.reps,
      seconds: format === 'Tabata' ? 20 : d.seconds,
      sets: typeof e?.sets === 'number' ? e.sets : 3,
      restSeconds: typeof e?.rest_after_sets_seconds === 'number' ? e.rest_after_sets_seconds : 45,
      roundIndex: typeof e?.round_index === 'number' ? e.round_index : null,
    }
  })

  const maxRound = exercises.reduce((m, e) => Math.max(m, e.roundIndex ?? 0), 0)

  return {
    workoutName: w.title ?? '',
    format,
    isCustomRounds,
    rounds: w.rounds ?? 3,
    restBetweenRoundsSeconds: w.rest_between_rounds_seconds ?? 0,
    customRoundCount: Math.max(1, maxRound || 1),
    amrapCapMinutes: format === 'AMRAP' ? (w.duration ?? 12) : 12,
    forTimeCapEnabled: format === 'For Time' && w.for_time_cap_seconds != null,
    forTimeCapMinutes:
      w.for_time_cap_seconds != null ? Math.round(w.for_time_cap_seconds / 60) : 15,
    emomMinutes: format === 'EMOM' ? (w.duration ?? 10) : 10,
    exercises,
    category: w.category as WorkoutCategory,
    difficulty: w.difficulty as WorkoutDifficulty,
    description: w.description ?? '',
    equipment: w.equipment ?? '',
    isNew: !!w.is_new,
    postedAgo: w.posted_ago ?? '',
  }
}

// Local "YYYY-MM-DDTHH:mm" for a datetime-local input, from an ISO timestamp.
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
