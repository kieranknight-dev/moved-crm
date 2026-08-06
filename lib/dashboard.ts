import { createAdminClient } from '@/lib/supabase/admin'
import type {
  WorkoutCategory,
  WorkoutFormat,
  WorkoutSource,
  RecipeCategory,
  ExerciseCategory,
  DietaryTag,
} from '@/lib/types'
import { RECIPE_CATEGORIES, EXERCISE_CATEGORY_VALUES, DIETARY_TAGS } from '@/lib/types'

// All workout source/category/format values the schema currently allows.
// Kept in one place so the breakdown queries and the returned object shape
// stay in sync with lib/types.ts.
const WORKOUT_SOURCES: readonly WorkoutSource[] = [
  'coach',
  'aiGenerated',
  'saved',
  'userCreated',
]
const WORKOUT_CATEGORIES: readonly WorkoutCategory[] = [
  'Strength',
  'HIIT',
  'Conditioning',
  'Mobility',
  'Full Body',
  'Upper Body',
  'Lower Body',
]
// 'Mobility' is a real format value in the live database (one row) that
// predates the current builder's six formats and isn't a value the builder
// itself can author — it's not part of the WorkoutFormat union used
// elsewhere (lib/builder.ts's format switches are exhaustive over the six
// authorable formats). Widened here, dashboard-display-only, so the format
// breakdown accounts for every row that actually exists.
export type DashboardWorkoutFormat = WorkoutFormat | 'Mobility'
const WORKOUT_FORMATS: readonly DashboardWorkoutFormat[] = [
  'Rounds',
  'AMRAP',
  'EMOM',
  'For Time',
  'Tabata',
  'Circuit',
  'Mobility',
]

const RECIPE_CATEGORY_VALUES: readonly RecipeCategory[] = RECIPE_CATEGORIES.map((c) => c.value)

const DAY_MS = 24 * 60 * 60 * 1000

// Gigi (the AI generator) runs on Anthropic's claude-sonnet-4-6. Pricing is
// USD per 1M tokens — update here if the model or Anthropic's rates change.
// Used to turn logged token counts into an estimated cost.
export const GIGI_PRICING = {
  model: 'claude-sonnet-4-6',
  inputPerM: 3.0,
  outputPerM: 15.0,
}

function gigiCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * GIGI_PRICING.inputPerM +
    (outputTokens / 1_000_000) * GIGI_PRICING.outputPerM
  )
}

interface ContentStats {
  total: number
  published: number
  archived: number
  scheduled: number
  missingImage: number
}

export interface DashboardStats {
  users: {
    total: number
    pro: number
  }
  workouts: ContentStats & {
    bySource: Record<WorkoutSource, number>
    byCategory: Record<WorkoutCategory, number>
    byFormat: Record<DashboardWorkoutFormat, number>
  }
  recipes: ContentStats & {
    byCategory: Record<RecipeCategory, number>
    dietaryTagCounts: Record<DietaryTag, number>
  }
  exercises: {
    total: number
    byCategory: Record<ExerciseCategory, number>
  }
  sessions: {
    total: number
    completed: number
    abandoned: number
    totalDurationSeconds: number
    avgDurationSeconds: number | null
  }
  gigiUsage: {
    total: number
    generations: number
    swaps: number
    inputTokens: number
    outputTokens: number
    estimatedCostUsd: number
    last30Days: { runs: number; estimatedCostUsd: number }
  }
  growth: {
    last7Days: {
      signups: number
      workoutsCreated: number
      recipesCreated: number
      sessions: number
    }
    last30Days: {
      signups: number
      workoutsCreated: number
      recipesCreated: number
      sessions: number
    }
  }
}

type CountableTable = 'profiles' | 'workouts' | 'recipes' | 'exercises' | 'workout_history' | 'gigi_usage'

// Cheap `head: true` count query — fetches zero rows, only the exact count.
async function exactCount(
  admin: ReturnType<typeof createAdminClient>,
  table: CountableTable,
  apply?: (
    query: ReturnType<ReturnType<typeof createAdminClient>['from']>
  ) => ReturnType<ReturnType<typeof createAdminClient>['from']>
): Promise<number> {
  let query = admin.from(table).select('*', { count: 'exact', head: true }) as ReturnType<
    ReturnType<typeof createAdminClient>['from']
  >
  if (apply) {
    query = apply(query)
  }
  const { count, error } = await query
  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`)
  }
  return count ?? 0
}

// Shared status/image-coverage stats for workouts and recipes — same four
// lifecycle states (see WorkoutStatus/RecipeStatus), same "missing image"
// content-health signal (image_ref / image_url).
async function contentStats(
  admin: ReturnType<typeof createAdminClient>,
  table: 'workouts' | 'recipes',
  imageColumn: 'image_ref' | 'image_url',
  extra?: (q: ReturnType<ReturnType<typeof createAdminClient>['from']>) => ReturnType<ReturnType<typeof createAdminClient>['from']>
): Promise<ContentStats> {
  const base = extra ?? ((q: ReturnType<ReturnType<typeof createAdminClient>['from']>) => q)
  const [total, published, archived, scheduled, missingImage] = await Promise.all([
    exactCount(admin, table, base),
    exactCount(admin, table, (q) => base(q).eq('status', 'published')),
    exactCount(admin, table, (q) => base(q).eq('status', 'archived')),
    exactCount(admin, table, (q) => base(q).eq('status', 'scheduled')),
    exactCount(admin, table, (q) =>
      base(q).or(`${imageColumn}.is.null,${imageColumn}.eq.`)
    ),
  ])
  return { total, published, archived, scheduled, missingImage }
}

/**
 * Computes live app-wide analytics for the admin dashboard. All numbers are
 * queried fresh from Supabase on every call using the service-role admin
 * client (bypasses RLS, since most of these tables are locked to
 * `authenticated` users only). No caching, no hardcoded placeholders.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const admin = createAdminClient()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS).toISOString()

  const [
    totalUsers,
    proUsers,
    workoutStats,
    recipeStats,
    workoutsBySource,
    workoutsByCategory,
    workoutsByFormat,
    recipesByCategory,
    dietaryTagCounts,
    totalExercises,
    exercisesByCategory,
    totalSessions,
    completedSessions,
    gigiRows,
    signups7d,
    signups30d,
    workoutsCreated7d,
    workoutsCreated30d,
    recipesCreated7d,
    recipesCreated30d,
    sessions7d,
    sessions30d,
    completedDurations,
  ] = await Promise.all([
    exactCount(admin, 'profiles'),
    exactCount(admin, 'profiles', (q) => q.eq('is_pro', true)),
    contentStats(admin, 'workouts', 'image_ref', (q) => q.eq('source', 'coach')),
    contentStats(admin, 'recipes', 'image_url'),
    Promise.all(
      WORKOUT_SOURCES.map((source) =>
        exactCount(admin, 'workouts', (q) => q.eq('source', source))
      )
    ),
    Promise.all(
      WORKOUT_CATEGORIES.map((category) =>
        exactCount(admin, 'workouts', (q) => q.eq('category', category))
      )
    ),
    Promise.all(
      WORKOUT_FORMATS.map((format) =>
        exactCount(admin, 'workouts', (q) => q.eq('format', format))
      )
    ),
    Promise.all(
      RECIPE_CATEGORY_VALUES.map((category) =>
        exactCount(admin, 'recipes', (q) => q.eq('category', category))
      )
    ),
    Promise.all(
      DIETARY_TAGS.map((tag) => exactCount(admin, 'recipes', (q) => q.contains('dietary_tags', [tag])))
    ),
    exactCount(admin, 'exercises'),
    Promise.all(
      EXERCISE_CATEGORY_VALUES.map((category) =>
        exactCount(admin, 'exercises', (q) => q.eq('category', category))
      )
    ),
    exactCount(admin, 'workout_history'),
    exactCount(admin, 'workout_history', (q) => q.not('completed_at', 'is', null)),
    // All Gigi events with tokens, aggregated below. Low-volume admin table,
    // so fetching rows (rather than SQL aggregation) is fine.
    admin.from('gigi_usage').select('mode, input_tokens, output_tokens, created_at'),
    exactCount(admin, 'profiles', (q) => q.gte('created_at', sevenDaysAgo)),
    exactCount(admin, 'profiles', (q) => q.gte('created_at', thirtyDaysAgo)),
    exactCount(admin, 'workouts', (q) => q.gte('created_at', sevenDaysAgo)),
    exactCount(admin, 'workouts', (q) => q.gte('created_at', thirtyDaysAgo)),
    exactCount(admin, 'recipes', (q) => q.gte('created_at', sevenDaysAgo)),
    exactCount(admin, 'recipes', (q) => q.gte('created_at', thirtyDaysAgo)),
    exactCount(admin, 'workout_history', (q) => q.gte('created_at', sevenDaysAgo)),
    exactCount(admin, 'workout_history', (q) => q.gte('created_at', thirtyDaysAgo)),
    admin
      .from('workout_history')
      .select('duration_seconds')
      .not('completed_at', 'is', null)
      .not('duration_seconds', 'is', null),
  ])

  const abandonedSessions = totalSessions - completedSessions

  const durations = (completedDurations.data ?? [])
    .map((row) => row.duration_seconds)
    .filter((value): value is number => typeof value === 'number')
  if (completedDurations.error) {
    throw new Error(
      `Failed to fetch session durations: ${completedDurations.error.message}`
    )
  }
  const totalDurationSeconds = durations.reduce((sum, value) => sum + value, 0)
  const avgDurationSeconds =
    durations.length > 0 ? totalDurationSeconds / durations.length : null

  // --- Gigi (Claude) usage + estimated cost ---
  if (gigiRows.error) {
    throw new Error(`Failed to load gigi_usage: ${gigiRows.error.message}`)
  }
  const gigi = gigiRows.data ?? []
  const thirtyDaysAgoMs = now.getTime() - 30 * DAY_MS
  let gigiGenerations = 0
  let gigiSwaps = 0
  let gigiInputTokens = 0
  let gigiOutputTokens = 0
  let gigiRuns30d = 0
  let gigiInput30d = 0
  let gigiOutput30d = 0
  for (const row of gigi) {
    const input = row.input_tokens ?? 0
    const output = row.output_tokens ?? 0
    // Legacy rows have null mode; treat them as generations (backfill intent).
    if (row.mode === 'swap') gigiSwaps++
    else gigiGenerations++
    gigiInputTokens += input
    gigiOutputTokens += output
    if (row.created_at && new Date(row.created_at).getTime() >= thirtyDaysAgoMs) {
      gigiRuns30d++
      gigiInput30d += input
      gigiOutput30d += output
    }
  }

  return {
    users: {
      total: totalUsers,
      pro: proUsers,
    },
    workouts: {
      ...workoutStats,
      bySource: Object.fromEntries(
        WORKOUT_SOURCES.map((source, i) => [source, workoutsBySource[i]])
      ) as Record<WorkoutSource, number>,
      byCategory: Object.fromEntries(
        WORKOUT_CATEGORIES.map((category, i) => [category, workoutsByCategory[i]])
      ) as Record<WorkoutCategory, number>,
      byFormat: Object.fromEntries(
        WORKOUT_FORMATS.map((format, i) => [format, workoutsByFormat[i]])
      ) as Record<DashboardWorkoutFormat, number>,
    },
    recipes: {
      ...recipeStats,
      byCategory: Object.fromEntries(
        RECIPE_CATEGORY_VALUES.map((category, i) => [category, recipesByCategory[i]])
      ) as Record<RecipeCategory, number>,
      dietaryTagCounts: Object.fromEntries(
        DIETARY_TAGS.map((tag, i) => [tag, dietaryTagCounts[i]])
      ) as Record<DietaryTag, number>,
    },
    exercises: {
      total: totalExercises,
      byCategory: Object.fromEntries(
        EXERCISE_CATEGORY_VALUES.map((category, i) => [category, exercisesByCategory[i]])
      ) as Record<ExerciseCategory, number>,
    },
    sessions: {
      total: totalSessions,
      completed: completedSessions,
      abandoned: abandonedSessions,
      totalDurationSeconds,
      avgDurationSeconds,
    },
    gigiUsage: {
      total: gigi.length,
      generations: gigiGenerations,
      swaps: gigiSwaps,
      inputTokens: gigiInputTokens,
      outputTokens: gigiOutputTokens,
      estimatedCostUsd: gigiCostUsd(gigiInputTokens, gigiOutputTokens),
      last30Days: {
        runs: gigiRuns30d,
        estimatedCostUsd: gigiCostUsd(gigiInput30d, gigiOutput30d),
      },
    },
    growth: {
      last7Days: {
        signups: signups7d,
        workoutsCreated: workoutsCreated7d,
        recipesCreated: recipesCreated7d,
        sessions: sessions7d,
      },
      last30Days: {
        signups: signups30d,
        workoutsCreated: workoutsCreated30d,
        recipesCreated: recipesCreated30d,
        sessions: sessions30d,
      },
    },
  }
}
