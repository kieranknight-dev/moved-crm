'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/require-admin'
import {
  buildInsert,
  resolvePublish,
  BUILDER_FORMAT_ORDER,
  CATEGORIES,
  DIFFICULTIES,
  type BuilderState,
  type PublishMode,
} from '@/lib/builder'

export type SaveResult = { ok: true } | { ok: false; error: string }

// Saves a coach workout with a publishing lifecycle. The client sends its
// BuilderState plus a publish choice; the payload (including status/publish_at)
// is rebuilt here — the client can't inject columns. buildInsert forces
// source='coach', user_id=null; RLS ("workouts: admin coach insert") is the
// final gate — only allowlisted admins pass.
export async function createCoachWorkout(
  state: BuilderState,
  mode: PublishMode,
  scheduledAt: string | null
): Promise<SaveResult> {
  const validExercises = state.exercises.filter((ex) => ex.name.trim().length > 0)
  if (validExercises.length === 0) {
    return { ok: false, error: 'Add at least one exercise before saving.' }
  }
  if (!BUILDER_FORMAT_ORDER.includes(state.format)) {
    return { ok: false, error: 'Unknown workout format.' }
  }
  if (!CATEGORIES.includes(state.category)) {
    return { ok: false, error: 'Pick a category.' }
  }
  if (!DIFFICULTIES.includes(state.difficulty)) {
    return { ok: false, error: 'Pick a difficulty.' }
  }

  const publish = resolvePublish(mode, scheduledAt)
  if ('error' in publish) {
    return { ok: false, error: publish.error }
  }

  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }

  const insert = buildInsert(state, publish)
  const { error } = await guard.admin.from('workouts').insert(insert)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/library')
  return { ok: true }
}

// Updates an existing coach workout (edit mode). Same validation and
// server-side rebuild as create; UPDATE by id (RLS "admin coach update" gates
// it). No .select() for the same RLS-visibility reason as insert.
export async function updateCoachWorkout(
  id: string,
  state: BuilderState,
  mode: PublishMode,
  scheduledAt: string | null
): Promise<SaveResult> {
  const validExercises = state.exercises.filter((ex) => ex.name.trim().length > 0)
  if (validExercises.length === 0) {
    return { ok: false, error: 'Add at least one exercise before saving.' }
  }
  if (!BUILDER_FORMAT_ORDER.includes(state.format)) {
    return { ok: false, error: 'Unknown workout format.' }
  }
  if (!CATEGORIES.includes(state.category)) {
    return { ok: false, error: 'Pick a category.' }
  }
  if (!DIFFICULTIES.includes(state.difficulty)) {
    return { ok: false, error: 'Pick a difficulty.' }
  }

  const publish = resolvePublish(mode, scheduledAt)
  if ('error' in publish) {
    return { ok: false, error: publish.error }
  }

  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }

  // buildInsert produces the full column set; we target an existing row by id
  // and never rewrite its identity (id/created_at aren't in the payload).
  const payload = buildInsert(state, publish)
  const { error } = await guard.admin
    .from('workouts')
    .update(payload)
    .eq('id', id)
    .eq('source', 'coach')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/library')
  return { ok: true }
}
