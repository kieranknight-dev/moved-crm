'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/require-admin'
import { resolvePublish, type PublishMode } from '@/lib/builder'
import {
  RECIPE_CATEGORIES,
  RECIPE_DIFFICULTIES,
  DIETARY_TAGS,
  type RecipeFormInput,
  type RecipeInsert,
  type RecipeUpdate,
} from '@/lib/types'

export type SaveResult = { ok: true } | { ok: false; error: string }

const CATEGORY_VALUES = RECIPE_CATEGORIES.map((c) => c.value)

// Validates the shared recipe form fields and builds the ingredient/step/tag
// arrays. Shared by create and update so both go through the same checks.
function validate(input: RecipeFormInput): { error: string } | { ingredients: string[]; steps: string[]; dietaryTags: string[] } {
  const name = input.name.trim()
  if (!name) return { error: 'Give the recipe a name.' }
  if (!CATEGORY_VALUES.includes(input.category)) {
    return { error: 'Pick a category.' }
  }
  if (!RECIPE_DIFFICULTIES.includes(input.difficulty)) {
    return { error: 'Pick a difficulty.' }
  }
  if (!Number.isFinite(input.prepMinutes) || input.prepMinutes < 0) {
    return { error: 'Prep time must be a positive number.' }
  }
  if (!Number.isInteger(input.servings) || input.servings < 1 || input.servings > 6) {
    return { error: 'Servings must be between 1 and 6.' }
  }

  const ingredients = input.ingredients.map((s) => s.trim()).filter(Boolean)
  const steps = input.steps.map((s) => s.trim()).filter(Boolean)
  if (ingredients.length === 0) return { error: 'Add at least one ingredient.' }
  if (steps.length === 0) return { error: 'Add at least one step.' }

  // Only allow tags from the fixed list (guards against injected values).
  const dietaryTags = input.dietaryTags.filter((t) =>
    (DIETARY_TAGS as readonly string[]).includes(t)
  )

  return { ingredients, steps, dietaryTags }
}

// Saves a new recipe. Mirrors createCoachWorkout: the client sends its form
// input + publish choice, the payload is rebuilt here (client can't inject
// columns), and the write goes through requireAdminClient (service role
// after an admin-email check). RLS ("Only admin can write recipes") is the
// backup gate. The image is already uploaded client-side to recipe-images;
// only its public URL is passed in.
export async function createRecipe(
  input: RecipeFormInput,
  mode: PublishMode,
  scheduledAt: string | null
): Promise<SaveResult> {
  const valid = validate(input)
  if ('error' in valid) return { ok: false, error: valid.error }

  const publish = resolvePublish(mode, scheduledAt)
  if ('error' in publish) return { ok: false, error: publish.error }

  const insert: RecipeInsert = {
    name: input.name.trim(),
    category: input.category,
    image_url: input.imageUrl,
    prep_minutes: Math.round(input.prepMinutes),
    difficulty: input.difficulty,
    servings: input.servings,
    dietary_tags: valid.dietaryTags,
    ingredients: valid.ingredients as unknown as RecipeInsert['ingredients'],
    steps: valid.steps as unknown as RecipeInsert['steps'],
    is_premium: input.isPremium,
    status: publish.status,
    publish_at: publish.publishAt,
  }

  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }

  const { error } = await guard.admin.from('recipes').insert(insert)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/recipe-library')
  return { ok: true }
}

// Updates an existing recipe. Same validation + rebuild-server-side pattern
// as updateCoachWorkout.
export async function updateRecipe(
  id: string,
  input: RecipeFormInput,
  mode: PublishMode,
  scheduledAt: string | null
): Promise<SaveResult> {
  const valid = validate(input)
  if ('error' in valid) return { ok: false, error: valid.error }

  const publish = resolvePublish(mode, scheduledAt)
  if ('error' in publish) return { ok: false, error: publish.error }

  const update: RecipeUpdate = {
    name: input.name.trim(),
    category: input.category,
    image_url: input.imageUrl,
    prep_minutes: Math.round(input.prepMinutes),
    difficulty: input.difficulty,
    servings: input.servings,
    dietary_tags: valid.dietaryTags,
    ingredients: valid.ingredients as unknown as RecipeUpdate['ingredients'],
    steps: valid.steps as unknown as RecipeUpdate['steps'],
    is_premium: input.isPremium,
    status: publish.status,
    publish_at: publish.publishAt,
  }

  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }

  const { error } = await guard.admin.from('recipes').update(update).eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/recipe-library')
  return { ok: true }
}
