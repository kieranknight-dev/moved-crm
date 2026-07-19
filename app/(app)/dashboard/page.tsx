import { getDashboardStats, GIGI_PRICING } from '@/lib/dashboard'
import {
  StatCard,
  Card,
  Donut,
  Legend,
  BreakdownBars,
  ActivityBars,
  CompletionRing,
  FORMAT_ACCENTS,
  CATEGORY_ACCENTS,
  SOURCE_LABELS,
  UsersIcon,
  DumbbellIcon,
  CheckIcon,
  ClockIcon,
  SparkIcon,
} from '@/components/dashboard'
import type { WorkoutFormat, WorkoutCategory, WorkoutSource } from '@/lib/types'

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

function plusDelta(n: number, noun: string): { text: string; positive?: boolean } {
  return n > 0
    ? { text: `+${n} ${noun} this week`, positive: true }
    : { text: `No new ${noun} this week`, positive: false }
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
        <div className="rounded-card bg-blush-50 border border-blush-100 p-5 text-sm text-blush-700">
          Couldn't load analytics. This usually means{' '}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> isn't set
          in <code className="font-mono">.env.local</code> yet. (
          {err instanceof Error ? err.message : 'Unknown error'})
        </div>
      </div>
    )
  }

  const { users, workouts, sessions, gigiUsage, growth } = stats

  const formatSegments = (Object.keys(FORMAT_ACCENTS) as WorkoutFormat[])
    .map((f) => ({ label: f, value: workouts.byFormat[f], color: FORMAT_ACCENTS[f] }))
    .sort((a, b) => b.value - a.value)

  const categoryItems = (Object.keys(CATEGORY_ACCENTS) as WorkoutCategory[])
    .map((c) => ({
      label: c,
      value: workouts.byCategory[c],
      color: CATEGORY_ACCENTS[c],
    }))
    .sort((a, b) => b.value - a.value)

  const sourceItems = (Object.keys(SOURCE_LABELS) as WorkoutSource[])
    .map((s) => ({ label: SOURCE_LABELS[s], value: workouts.bySource[s] }))
    .sort((a, b) => b.value - a.value)

  const avgSession =
    sessions.avgDurationSeconds != null
      ? formatDuration(Math.round(sessions.avgDurationSeconds))
      : '—'

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-500 mt-1">
          Live from Supabase · app-wide activity across MOVED.
        </p>
      </div>

      {/* Top stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Users"
          value={users.total.toLocaleString()}
          icon={<UsersIcon />}
          delta={plusDelta(growth.last7Days.signups, 'signups')}
          spark={[growth.last30Days.signups, growth.last7Days.signups]}
        />
        <StatCard
          label="Workouts"
          value={workouts.total.toLocaleString()}
          icon={<DumbbellIcon />}
          delta={plusDelta(growth.last7Days.workoutsCreated, 'workouts')}
          spark={[
            growth.last30Days.workoutsCreated,
            growth.last7Days.workoutsCreated,
          ]}
        />
        <StatCard
          label="Sessions done"
          value={sessions.completed.toLocaleString()}
          icon={<CheckIcon />}
          delta={plusDelta(growth.last7Days.sessions, 'sessions')}
          spark={[growth.last30Days.sessions, growth.last7Days.sessions]}
        />
        <StatCard
          label="Time trained"
          value={formatDuration(sessions.totalDurationSeconds)}
          icon={<ClockIcon />}
          delta={{ text: `${avgSession} avg / session`, positive: true }}
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

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Workouts by format">
          {workouts.total > 0 ? (
            <div className="flex items-center gap-6">
              <Donut
                segments={formatSegments}
                centerValue={workouts.total.toLocaleString()}
                centerLabel="total"
              />
              <Legend items={formatSegments.filter((s) => s.value > 0)} />
            </div>
          ) : (
            <EmptyNote>No workouts yet.</EmptyNote>
          )}
        </Card>

        <Card title="Workouts by category">
          {workouts.total > 0 ? (
            <BreakdownBars items={categoryItems} />
          ) : (
            <EmptyNote>No workouts yet.</EmptyNote>
          )}
        </Card>

        <Card
          title="Content source"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
              <span className="text-blush-600">
                <SparkIcon />
              </span>
              {gigiUsage.total} Gigi run{gigiUsage.total === 1 ? '' : 's'}
            </span>
          }
        >
          {workouts.total > 0 ? (
            <BreakdownBars items={sourceItems} />
          ) : (
            <EmptyNote>No workouts yet.</EmptyNote>
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
              <p className="text-[11px] text-ink-300 leading-relaxed">
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
    <div className="rounded-card bg-blush-50 p-4">
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
