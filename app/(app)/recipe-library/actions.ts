'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/require-admin'

export type ActionResult = { ok: true } | { ok: false; error: string }

// All CRM recipe writes run as the service role after an admin identity
// check (see require-admin.ts for why service role rather than the user
// session — a drafted/archived row isn't SELECT-visible under RLS, so an
// UPDATE from the user's own session would trip RLS on the round-trip).

// Soft-hide: mirrors archiveWorkout. Hidden from the app (status != a
// visible status) but stays in the CRM library, can be restored.
export async function archiveRecipe(id: string): Promise<ActionResult> {
  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }
  const { error } = await guard.admin
    .from('recipes')
    .update({ status: 'archived', publish_at: null })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/recipe-library')
  return { ok: true }
}

// Bring an archived recipe back as a draft (admin re-decides when to publish).
export async function restoreRecipe(id: string): Promise<ActionResult> {
  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }
  const { error } = await guard.admin
    .from('recipes')
    .update({ status: 'draft' })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/recipe-library')
  return { ok: true }
}

// Hard delete. Unlike workouts, recipes have no dependent tables (no
// recipe_history / FK referencing recipes.id), so a real delete is safe here
// — the UI still gates it behind a confirm() prompt since it's irreversible.
export async function deleteRecipe(id: string): Promise<ActionResult> {
  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }
  const { error } = await guard.admin.from('recipes').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/recipe-library')
  return { ok: true }
}
