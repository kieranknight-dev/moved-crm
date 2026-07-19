import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ExerciseCategory } from '@/lib/types'
import { builderStateFromWorkout, publishInitFromStatus } from '@/lib/builder'
import BuilderClient, { type BuilderInit } from './BuilderClient'
import type { PickerExercise } from './ExercisePicker'

// Reads the 874-row exercise library (authenticated read is allowed by RLS)
// and hands it to the client builder. With ?id=, loads that workout for editing
// (via the admin client, since drafts/scheduled aren't RLS-visible). Dynamic.
export const dynamic = 'force-dynamic'

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select('name, category')
    .order('name')

  const exercises: PickerExercise[] = (data ?? []).map((e) => ({
    name: e.name,
    category: e.category as ExerciseCategory,
  }))

  if (error) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink-900 mb-2">New workout</h1>
        <p className="rounded-card bg-blush-50 border border-blush-100 px-4 py-3 text-sm text-blush-700">
          Couldn’t load the exercise library ({error.message}).
        </p>
      </div>
    )
  }

  // Edit mode: load the workout (admin client — it may be a draft/scheduled row
  // the coach RLS policy hides) and reconstruct the builder state.
  let init: BuilderInit | undefined
  if (searchParams.id) {
    const admin = createAdminClient()
    const { data: workout } = await admin
      .from('workouts')
      .select('*')
      .eq('id', searchParams.id)
      .eq('source', 'coach')
      .single()
    if (workout) {
      const publish = publishInitFromStatus(workout.status, workout.publish_at)
      init = {
        workoutId: workout.id,
        state: builderStateFromWorkout(workout),
        publishMode: publish.mode,
        scheduledLocal: publish.scheduledLocal,
      }
    }
  }

  return <BuilderClient exercises={exercises} init={init} />
}
