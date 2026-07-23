// Domain types for the REAL MOVED Supabase schema, confirmed against the live
// database (supabase gen types → ./database.types.ts) and the iOS Swift models
// (Models/Workout.swift, Models/ExerciseLibrary.swift) on 2026-07-16.
//
// All string enum values below are case-sensitive and MUST match the Swift
// enum raw values exactly — the iOS app decodes them with no fallback.
//
// Schema facts that differ from the original scaffold guesses:
//   - Exercises within a workout are a JSONB array on workouts.exercises;
//     there is NO workout_exercises junction table.
//   - The exercise picker dataset lives in the `exercises` table (874 rows,
//     migrated from the iOS bundle on 2026-07-16): name + equipment category.
//   - There are NO status / publish_at columns yet — scheduling lands in
//     build-order step 5 and these types will grow then.

import type { Database } from './database.types'

// Raw table rows straight from the generated types.
export type WorkoutRow = Database['public']['Tables']['workouts']['Row']
export type WorkoutInsert = Database['public']['Tables']['workouts']['Insert']

// --- Recipes (sibling to workouts; see supabase/migrations/*_recipes.sql) ---
export type RecipeRow = Database['public']['Tables']['recipes']['Row']
export type RecipeInsert = Database['public']['Tables']['recipes']['Insert']
export type RecipeUpdate = Database['public']['Tables']['recipes']['Update']

// Publishing lifecycle — identical shape to WorkoutStatus (see
// supabase/migrations/20260721125000_recipes_status_publishing.sql). The app
// only shows recipes that are 'published' or a due 'scheduled' row (enforced
// by RLS); 'archived' is a soft-delete for the library.
export type RecipeStatus = 'draft' | 'scheduled' | 'published' | 'archived'

// Category is stored lowercase (matches the DB CHECK); the form shows
// capitalized labels.
export type RecipeCategory = 'breakfast' | 'lunch_dinner' | 'snack'
export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch_dinner', label: 'Lunch / Dinner' },
  { value: 'snack', label: 'Snack' },
]

export type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard'
export const RECIPE_DIFFICULTIES: RecipeDifficulty[] = ['Easy', 'Medium', 'Hard']

// Fixed dietary-tag list (checkboxes, not freeform) so data stays consistent
// and the iOS app can filter on it later. Extend by adding to this array.
export const DIETARY_TAGS = [
  'Dairy Free',
  'Gluten Free',
  'Nut Free',
  'Vegetarian',
  'Vegan',
  'Meat',
  'Fish',
] as const
export type DietaryTag = (typeof DIETARY_TAGS)[number]

// What the Recipe Builder form collects. The server action maps this to a
// RecipeInsert (ingredients/steps → JSONB string arrays). image_url is the
// public URL returned after the client-side upload to recipe-images.
export interface RecipeFormInput {
  name: string
  category: RecipeCategory
  imageUrl: string | null
  prepMinutes: number
  difficulty: RecipeDifficulty
  servings: number
  dietaryTags: string[]
  ingredients: string[]
  steps: string[]
  isPremium: boolean
}
export type WorkoutUpdate = Database['public']['Tables']['workouts']['Update']
export type ExerciseRow = Database['public']['Tables']['exercises']['Row']

// Swift: WorkoutFormat
export type WorkoutFormat =
  | 'Rounds'
  | 'AMRAP'
  | 'EMOM'
  | 'For Time'
  | 'Tabata'
  | 'Circuit'

// Swift: WorkoutDifficulty
export type WorkoutDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

// Swift: WorkoutCategory
export type WorkoutCategory =
  | 'Strength'
  | 'HIIT'
  | 'Conditioning'
  | 'Mobility'
  | 'Full Body'
  | 'Upper Body'
  | 'Lower Body'

// Swift: WorkoutSource. The CRM writes 'coach' rows (Georgia's content);
// the other three are user-owned values the CRM must never write.
export type WorkoutSource = 'coach' | 'aiGenerated' | 'saved' | 'userCreated'

// Publishing lifecycle (added in the status/publish_at migration). The app
// only shows coach workouts that are 'published' with publish_at <= now()
// (enforced by RLS); 'archived' is a soft-delete for the library.
export type WorkoutStatus = 'draft' | 'scheduled' | 'published' | 'archived'

// Swift: ExerciseCategory — equipment-derived, enforced by a CHECK constraint
// on exercises.category.
export type ExerciseCategory =
  | 'Bodyweight'
  | 'Dumbbell'
  | 'Barbell'
  | 'Kettlebell'
  | 'Machine'
  | 'Other'

// One element of the workouts.exercises JSONB array — mirrors the Swift
// `Exercise` struct's CodingKeys exactly.
// Structured value kind for Circuit exercises (supersedes inferring this from
// `detail` text). 'seconds' covers what used to be the separate isTimed flag —
// unit is now authoritative for what `value` counts, timed or not.
export type StructuredExerciseUnit = 'reps' | 'seconds' | 'calories' | 'distance_m'

export interface WorkoutExercise {
  id: string // UUID
  name: string
  // Circuit: deprecated once callers read value/unit/rest_seconds instead —
  // still written (derived from those fields, not hand-formatted) so legacy
  // readers and the required Swift `detail` field keep decoding. Other
  // formats still treat this as their source of truth for now.
  detail: string // display string: "12 reps", "45 sec", "10 reps each side"
  // Circuit only (2026-07-23 migration: 20260723090000_circuit_structured_values.sql).
  value?: number | null
  unit?: StructuredExerciseUnit | null
  rest_seconds?: number | null // per-exercise rest; null = none authored
  sets?: number | null // Strength only; null falls back to workout.rounds
  rest_after_sets_seconds?: number | null // Strength only; null falls back to 45
  round_index?: number | null // Circuit/Tabata custom-rounds tag, 1-based; null = same-every-round
}

// workouts row with the string/JSONB columns narrowed to their domain types.
export interface Workout
  extends Omit<
    WorkoutRow,
    'format' | 'difficulty' | 'category' | 'source' | 'status' | 'exercises'
  > {
  format: WorkoutFormat
  difficulty: WorkoutDifficulty
  category: WorkoutCategory
  source: WorkoutSource
  status: WorkoutStatus
  exercises: WorkoutExercise[]
}

// exercises row with category narrowed. Note: `name` is UNIQUE and is the
// identity the iOS picker uses.
export interface Exercise extends Omit<ExerciseRow, 'category'> {
  category: ExerciseCategory
}
