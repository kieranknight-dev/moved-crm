'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/require-admin'

export type ActionResult = { ok: true } | { ok: false; error: string }

// All CRM coach writes run as the service role after an admin identity check
// (see require-admin.ts for why service role rather than the user session).

// Soft-delete: archive is the only "delete" — a workout may be referenced by
// workout_history, so rows are never hard-deleted. Archived rows are hidden
// from the app (status != 'published') but stay in the CRM library.
export async function archiveWorkout(id: string): Promise<ActionResult> {
  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }
  const { error } = await guard.admin
    .from('workouts')
    .update({ status: 'archived', publish_at: null })
    .eq('id', id)
    .eq('source', 'coach')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/library')
  return { ok: true }
}

// Bring an archived workout back as a draft (admin re-decides when to publish).
export async function restoreWorkout(id: string): Promise<ActionResult> {
  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }
  const { error } = await guard.admin
    .from('workouts')
    .update({ status: 'draft' })
    .eq('id', id)
    .eq('source', 'coach')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/library')
  return { ok: true }
}

// Duplicate a workout as a fresh draft.
export async function duplicateWorkout(id: string): Promise<ActionResult> {
  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }

  const { data: src, error: readErr } = await guard.admin
    .from('workouts')
    .select('*')
    .eq('id', id)
    .eq('source', 'coach')
    .single()
  if (readErr || !src) {
    return { ok: false, error: readErr?.message ?? 'Workout not found.' }
  }

  const { error } = await guard.admin.from('workouts').insert({
    user_id: null,
    title: `${src.title} (copy)`,
    duration: src.duration,
    difficulty: src.difficulty,
    category: src.category,
    source: 'coach',
    image_ref: src.image_ref,
    is_new: false,
    is_favorited: false,
    is_shared: false,
    posted_ago: null,
    description: src.description,
    equipment: src.equipment,
    format: src.format,
    rounds: src.rounds,
    exercises: src.exercises,
    rest_between_rounds_seconds: src.rest_between_rounds_seconds,
    for_time_cap_seconds: src.for_time_cap_seconds,
    status: 'draft', // copies never auto-publish
    publish_at: null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/library')
  return { ok: true }
}
