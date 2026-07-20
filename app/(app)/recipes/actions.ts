'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/require-admin'
import {
  RECIPE_CATEGORIES,
  RECIPE_DIFFICULTIES,
  DIETARY_TAGS,
  type RecipeFormInput,
  type RecipeInsert,
} from '@/lib/types'

export type SaveResult = { ok: true } | { ok: false; error: string }

const CATEGORY_VALUES = RECIPE_CATEGORIES.map((c) => c.value)

// Saves a recipe. Mirrors createCoachWorkout: the client sends its form input,
// the payload is rebuilt here (client can't inject columns), and the write goes
// through requireAdminClient (service role after an admin-email check). RLS
// ("Only admin can write recipes") is the backup gate. The image is already
// uploaded client-side to recipe-images; only its public URL is passed in.
export async function createRecipe(input: RecipeFormInput): Promise<SaveResult> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Give the recipe a name.' }
  if (!CATEGORY_VALUES.includes(input.category)) {
    return { ok: false, error: 'Pick a category.' }
  }
  if (!RECIPE_DIFFICULTIES.includes(input.difficulty)) {
    return { ok: false, error: 'Pick a difficulty.' }
  }
  if (!Number.isFinite(input.prepMinutes) || input.prepMinutes < 0) {
    return { ok: false, error: 'Prep time must be a positive number.' }
  }
  if (!Number.isInteger(input.servings) || input.servings < 1 || input.servings > 6) {
    return { ok: false, error: 'Servings must be between 1 and 6.' }
  }

  const ingredients = input.ingredients.map((s) => s.trim()).filter(Boolean)
  const steps = input.steps.map((s) => s.trim()).filter(Boolean)
  if (ingredients.length === 0) {
    return { ok: false, error: 'Add at least one ingredient.' }
  }
  if (steps.length === 0) {
    return { ok: false, error: 'Add at least one step.' }
  }

  // Only allow tags from the fixed list (guards against injected values).
  const dietaryTags = input.dietaryTags.filter((t) =>
    (DIETARY_TAGS as readonly string[]).includes(t)
  )

  const insert: RecipeInsert = {
    name,
    category: input.category,
    image_url: input.imageUrl,
    prep_minutes: Math.round(input.prepMinutes),
    difficulty: input.difficulty,
    servings: input.servings,
    dietary_tags: dietaryTags,
    ingredients: ingredients as unknown as RecipeInsert['ingredients'],
    steps: steps as unknown as RecipeInsert['steps'],
    is_premium: input.isPremium,
  }

  const guard = await requireAdminClient()
  if ('error' in guard) return { ok: false, error: guard.error }

  const { error } = await guard.admin.from('recipes').insert(insert)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/recipes')
  return { ok: true }
}
