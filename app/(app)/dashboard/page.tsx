import { getDashboardStats, GIGI_PRICING } from '@/lib/dashboard'
import {
  Card,
  CardTakeaway,
  KpiCard,
  ProgressBar,
  Donut,
  Legend,
  BreakdownBars,
  ActivityBars,
  CompletionRing,
  ContentHealthPanel,
  FORMAT_ACCENTS,
  EXERCISE_CATEGORY_ACCENTS,
  RECIPE_CATEGORY_ACCENTS,
  RECIPE_CATEGORY_LABELS,
  UsersIcon,
  CheckIcon,
  SparkIcon,
  LayersIcon,
} from '@/components/dashboard'
import type { ExerciseCategory, RecipeCategory } from '@/lib/types'
import type { DashboardWorkoutFormat } from '@/lib/dashboard'

// Always render fresh — these are live counts, not build-time data.
export const dynamic = 'force-dynamic'

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function plusDelta(n: number, noun: string): string {
  return n > 0 ? `+${n} ${noun} this week` : `No new ${noun} this week`
}

// Costs are typically fractions of a dollar — show cents-level precision so a
// real spend never rounds to $0.00.
function formatUsd(n: number): string {
  if (n === 0) return '$0.00'
  return n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}

export default async function DashboardPage() {
  let stats
  try {
    stats = await getDashboardStats()
  } catch (err) {
    return (
      <div>
        <h1 className="font-display text-2xl mb-2 text-ink-900">Dashboard</h1>
        <div className="rounded-card bg-error-tint border border-error-border p-5 text-sm text-error-text">
          Couldn't load analytics. This usually means{' '}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> isn't set
          in <code className="font-mono">.env.local</code> yet. (
          {err instanceof Error ? err.message : 'Unknown error'})
        </div>
      </div>
    )
  }

  const { users, workouts, recipes, exercises, sessions, gigiUsage, growth } = stats

  const formatSegments = (Object.keys(FORMAT_ACCENTS) as DashboardWorkoutFormat[])
    .map((f) => ({ label: f, value: workouts.byFormat[f], color: FORMAT_ACCENTS[f] }))
    .sort((a, b) => b.value - a.value)

  const exerciseItems = (Object.keys(EXERCISE_CATEGORY_ACCENTS) as ExerciseCategory[])
    .map((c) => ({ label: c, value: exercises.byCategory[c], color: EXERCISE_CATEGORY_ACCENTS[c] }))
    .sort((a, b) => b.value - a.value)
  const deepestExerciseCategory = exerciseItems[0]

  const recipeCategoryItems = (Object.keys(RECIPE_CATEGORY_ACCENTS) as RecipeCategory[])
    .map((c) => ({
      label: RECIPE_CATEGORY_LABELS[c],
      value: recipes.byCategory[c],
      color: RECIPE_CATEGORY_ACCENTS[c],
    }))
    .sort((a, b) => b.value - a.value)
  const thinnestRecipeCategory = [...recipeCategoryItems].sort((a, b) => a.value - b.value)[0]
  const thickestRecipeCategory = recipeCategoryItems[0]

  const avgSession =
    sessions.avgDurationSeconds != null
      ? formatDuration(Math.round(sessions.avgDurationSeconds))
      : '—'
  const finishRate = sessions.total > 0 ? Math.round((sessions.completed / sessions.total) * 100) : 0

  const itemsLive = workouts.published + recipes.published
  const newContentThisWeek = growth.last7Days.workoutsCreated + growth.last7Days.recipesCreated

  const proPct = users.total > 0 ? Math.round((users.pro / users.total) * 100) : 0

  const scheduledCount = workouts.scheduled + recipes.scheduled
  const workoutImagesCovered = workouts.total - workouts.missingImage
  const recipeImagesCovered = recipes.total - recipes.missingImage
  const gapCount =
    (workoutImagesCovered < workouts.total ? 1 : 0) +
    (recipeImagesCovered < recipes.total ? 1 : 0) +
    (scheduledCount === 0 ? 1 : 0)

  const costPerRun = gigiUsage.total > 0 ? gigiUsage.estimatedCostUsd / gigiUsage.total : 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-500 mt-1">
          Live from Supabase · app-wide activity across MOVED.
        </p>
      </div>

      {/* Row 1 — KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Items live in the app"
          value={itemsLive.toLocaleString()}
          icon={<LayersIcon />}
          delta={plusDelta(newContentThisWeek, 'items')}
          footer={
            <>
              {workouts.published} workouts · {recipes.published} recipes
            </>
          }
        />
        <KpiCard
          label="Registered users"
          value={users.total.toLocaleString()}
          icon={<UsersIcon />}
          delta={plusDelta(growth.last7Days.signups, 'signups')}
        >
          <div className="mt-3">
            <ProgressBar value={users.pro} total={users.total} color="#E58AA1" />
            <p className="text-xs text-ink-500 mt-1.5">
              {users.pro} Pro · {proPct}%
            </p>
          </div>
        </KpiCard>
        <KpiCard
          label="Sessions completed"
          value={sessions.completed.toLocaleString()}
          icon={<CheckIcon />}
          delta={plusDelta(growth.last7Days.sessions, 'sessions')}
          footer={
            <>
              {finishRate}% finish rate · {avgSession} avg
            </>
          }
        />
        <KpiCard
          label="Gigi spend, all time"
          value={formatUsd(gigiUsage.estimatedCostUsd)}
          icon={<SparkIcon />}
          footer={
            <>
              {gigiUsage.total} runs · {formatUsd(costPerRun)}/run ·{' '}
              <span className="font-mono">{GIGI_PRICING.model}</span>
            </>
          }
        />
      </div>

      {/* Row 2 — Content health */}
      <div className="mb-6">
        <ContentHealthPanel
          workoutImages={{ covered: workoutImagesCovered, total: workouts.total }}
          recipeImages={{ covered: recipeImagesCovered, total: recipes.total }}
          scheduledCount={scheduledCount}
          gapCount={gapCount}
        />
      </div>

      {/* Activity + completion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card title="Activity" className="lg:col-span-2">
          <ActivityBars
            rows={[
              {
                label: 'New signups',
                week: growth.last7Days.signups,
                month: growth.last30Days.signups,
              },
              {
                label: 'Workouts created',
                week: growth.last7Days.workoutsCreated,
                month: growth.last30Days.workoutsCreated,
              },
              {
                label: 'Sessions logged',
                week: growth.last7Days.sessions,
                month: growth.last30Days.sessions,
              },
            ]}
          />
        </Card>

        <Card title="Session completion">
          <div className="flex items-center gap-5">
            <CompletionRing completed={sessions.completed} total={sessions.total} />
            <dl className="space-y-3 text-sm flex-1">
              <div className="flex justify-between">
                <dt className="text-ink-500">Started</dt>
                <dd className="text-ink-900 tabular-nums">{sessions.total}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Completed</dt>
                <dd className="text-ink-900 tabular-nums">{sessions.completed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Abandoned</dt>
                <dd className="text-ink-900 tabular-nums">{sessions.abandoned}</dd>
              </div>
            </dl>
          </div>
        </Card>
      </div>

      {/* Row 3 — Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Workouts by format">
          {workouts.byFormat && Object.values(workouts.byFormat).some((v) => v > 0) ? (
            <>
              <div className="flex items-center gap-6">
                <Donut
                  segments={formatSegments}
                  centerValue={formatSegments.reduce((s, f) => s + f.value, 0).toLocaleString()}
                  centerLabel="total"
                />
                <Legend items={formatSegments.filter((s) => s.value > 0)} />
              </div>
            </>
          ) : (
            <EmptyNote>No workouts yet.</EmptyNote>
          )}
        </Card>

        <Card title="Exercise library">
          {exercises.total > 0 ? (
            <>
              <BreakdownBars items={exerciseItems.filter((i) => i.value > 0)} />
              {deepestExerciseCategory && (
                <CardTakeaway>
                  {exercises.total} total ·{' '}
                  <span className="font-medium text-ink-900">{deepestExerciseCategory.label}</span>{' '}
                  is the deepest at {deepestExerciseCategory.value}
                </CardTakeaway>
              )}
            </>
          ) : (
            <EmptyNote>No exercises yet.</EmptyNote>
          )}
        </Card>

        <Card title="Recipes by category">
          {recipes.total > 0 ? (
            <>
              <BreakdownBars items={recipeCategoryItems} />
              <div className="mt-4 pt-4 border-t border-line-divider">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500 mb-2">
                  Dietary coverage
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(recipes.dietaryTagCounts).map(([tag, count]) => (
                    <span
                      key={tag}
                      className="rounded-pill bg-surface-warm px-2.5 py-1 text-xs text-ink-700"
                    >
                      {tag} {count}
                    </span>
                  ))}
                </div>
              </div>
              {thinnestRecipeCategory && thickestRecipeCategory && (
                <CardTakeaway>
                  <span className="font-medium text-ink-900">{thinnestRecipeCategory.label}</span> is
                  thin — {thinnestRecipeCategory.value} vs {thickestRecipeCategory.value}
                </CardTakeaway>
              )}
            </>
          ) : (
            <EmptyNote>No recipes yet.</EmptyNote>
          )}
        </Card>
      </div>

      {/* Gigi (Claude) usage + cost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card
          title="Gigi AI usage & cost"
          action={
            <span className="text-xs text-ink-500 font-mono">{GIGI_PRICING.model}</span>
          }
        >
          {gigiUsage.total > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <MiniStat
                  label="Est. cost (all time)"
                  value={formatUsd(gigiUsage.estimatedCostUsd)}
                  accent
                />
                <MiniStat
                  label="Est. cost (30 days)"
                  value={formatUsd(gigiUsage.last30Days.estimatedCostUsd)}
                />
              </div>
              <dl className="space-y-2.5 text-sm">
                <StatRow
                  label="Total runs"
                  value={`${gigiUsage.total} · ${gigiUsage.generations} gen, ${gigiUsage.swaps} swap`}
                />
                <StatRow
                  label="Input tokens"
                  value={gigiUsage.inputTokens.toLocaleString()}
                />
                <StatRow
                  label="Output tokens"
                  value={gigiUsage.outputTokens.toLocaleString()}
                />
              </dl>
              <p className="text-[11px] text-ink-400 leading-relaxed">
                Estimated from logged tokens at ${GIGI_PRICING.inputPerM}/M input · $
                {GIGI_PRICING.outputPerM}/M output. Runs before token logging was
                added count as runs but $0 cost.
              </p>
            </div>
          ) : (
            <EmptyNote>No Gigi generations logged yet.</EmptyNote>
          )}
        </Card>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-card p-4 ${accent ? 'bg-blush-50' : 'bg-surface-warm'}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl tabular-nums ${accent ? 'text-blush-600' : 'text-ink-900'}`}
      >
        {value}
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900 tabular-nums">{value}</dd>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-sm text-ink-500">{children}</div>
  )
}
