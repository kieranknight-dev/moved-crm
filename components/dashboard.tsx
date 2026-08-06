// Presentational pieces for the analytics dashboard. All server-safe (no
// client state), dependency-free — charts are hand-built SVG, matching how the
// MOVED iOS design system draws its progress rings.
//
// Colors come from the "Blush on White" v2 tokens + the workout-format accents
// documented in design-reference/design-tokens.md §1. Per the 2026-08 redesign,
// blush is reserved for interactive intent (CTA, active nav) plus exactly one
// chart series (the session-completion ring) — everything structural here
// (card chrome, chart tracks, table-style rows) uses the warm-neutral tokens.

import type { ReactNode } from 'react'
import type { WorkoutCategory, WorkoutSource, RecipeCategory, ExerciseCategory } from '@/lib/types'
import { RECIPE_CATEGORIES } from '@/lib/types'
import type { DashboardWorkoutFormat } from '@/lib/dashboard'

// Muted format accents (design-tokens.md §1 "Workout-format accents").
export const FORMAT_ACCENTS: Record<DashboardWorkoutFormat, string> = {
  Rounds: '#8D7BA6',
  AMRAP: '#C4704F',
  EMOM: '#7A92A5',
  'For Time': '#B76578',
  Tabata: '#6FA39B',
  Circuit: '#7E9770',
  Mobility: '#8E97C7', // FormatAccent.mobility (iOS tokens)
}

// Categories reuse the same muted accent family for visual consistency.
export const CATEGORY_ACCENTS: Record<WorkoutCategory, string> = {
  Strength: '#B98A4A',
  HIIT: '#C4704F',
  Conditioning: '#7A92A5',
  Mobility: '#7E9770',
  'Full Body': '#8D7BA6',
  'Upper Body': '#B76578',
  'Lower Body': '#6FA39B',
}

export const RECIPE_CATEGORY_ACCENTS: Record<RecipeCategory, string> = {
  breakfast: '#B98A4A',
  lunch_dinner: '#7E9770',
  snack: '#B76578',
}
export const RECIPE_CATEGORY_LABELS: Record<RecipeCategory, string> = Object.fromEntries(
  RECIPE_CATEGORIES.map((c) => [c.value, c.label])
) as Record<RecipeCategory, string>

export const EXERCISE_CATEGORY_ACCENTS: Record<ExerciseCategory, string> = {
  Bodyweight: '#8D7BA6',
  Dumbbell: '#B98A4A',
  Barbell: '#7A92A5',
  Kettlebell: '#6FA39B',
  'Resistance Band': '#B76578',
  Cardio: '#7E9770',
  Machine: '#C4704F',
  Other: '#A89E96',
}

export const SOURCE_LABELS: Record<WorkoutSource, string> = {
  coach: 'Coach',
  aiGenerated: 'Gigi (AI)',
  saved: 'Saved',
  userCreated: 'User-built',
}

// ---------------------------------------------------------------------------
// KPI card — icon badge, delta chip, big figure, footer stats above a hairline.
// ---------------------------------------------------------------------------

export function KpiCard({
  label,
  value,
  icon,
  delta,
  footer,
  children,
}: {
  label: string
  value: string
  icon: ReactNode
  delta?: string
  footer?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="rounded-card bg-white border border-line-card shadow-card p-5">
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-9 w-9 rounded-pill bg-surface-warm text-ink-700">
          {icon}
        </span>
        {delta && (
          <span className="rounded-pill bg-surface-warm px-2.5 py-1 text-[11px] font-medium text-ink-500">
            {delta}
          </span>
        )}
      </div>
      <div className="mt-4 font-display text-[34px] leading-none text-ink-900 tabular-nums">
        {value}
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-ink-500 mt-1.5">
        {label}
      </div>
      {children}
      {footer && (
        <div className="mt-3 pt-3 border-t border-line-divider text-xs text-ink-500">
          {footer}
        </div>
      )}
    </div>
  )
}

export function ProgressBar({
  value,
  total,
  color = '#5F8D72',
  trackClassName = 'bg-surface-warm',
}: {
  value: number
  total: number
  color?: string
  trackClassName?: string
}) {
  const pct = total > 0 ? Math.min(1, value / total) : 0
  return (
    <div className={`h-2 rounded-pill overflow-hidden ${trackClassName}`}>
      <div
        className="h-full rounded-pill transition-[width]"
        style={{ width: `${pct * 100}%`, backgroundColor: color, minWidth: value > 0 ? '4px' : 0 }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card shell + section header
// ---------------------------------------------------------------------------

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-card bg-white border border-line-card shadow-card p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-base font-bold text-ink-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function CardTakeaway({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 pt-3 border-t border-line-divider text-xs text-ink-500">{children}</p>
  )
}

// ---------------------------------------------------------------------------
// Donut chart — segmented ring with a centered total. Used for workout formats.
// ---------------------------------------------------------------------------

export function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[]
  centerValue: string
  centerLabel: string
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const r = 52
  const circumference = 2 * Math.PI * r
  const gap = total > 1 ? 2 : 0 // small visual gap between segments

  let offset = 0
  const arcs = segments
    .filter((seg) => seg.value > 0)
    .map((seg) => {
      const frac = total > 0 ? seg.value / total : 0
      const len = Math.max(0, frac * circumference - gap)
      const arc = (
        <circle
          key={seg.label}
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth="15"
          strokeLinecap="round"
          strokeDasharray={`${len} ${circumference - len}`}
          strokeDashoffset={-offset}
          transform="rotate(-90 70 70)"
        />
      )
      offset += frac * circumference
      return arc
    })

  return (
    <div className="relative h-[140px] w-[140px] shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#F4F1ED" strokeWidth="15" />
        {total > 0 && arcs}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-2xl leading-none text-ink-900 tabular-nums">
            {centerValue}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">{centerLabel}</div>
        </div>
      </div>
    </div>
  )
}

export function Legend({
  items,
  columns = 1,
}: {
  items: { label: string; value: number; color: string }[]
  columns?: 1 | 2
}) {
  return (
    <ul className={`flex-1 min-w-0 gap-2.5 ${columns === 2 ? 'grid grid-cols-2' : 'space-y-2.5'}`}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2.5 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-pill shrink-0"
            style={{ backgroundColor: it.color }}
          />
          <span className="text-ink-900 truncate">{it.label}</span>
          <span className="ml-auto text-ink-500 tabular-nums">{it.value}</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Horizontal proportion bars — used for category / source / equipment breakdowns.
// ---------------------------------------------------------------------------

export function BreakdownBars({
  items,
}: {
  items: { label: string; value: number; color?: string }[]
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-ink-900">{it.label}</span>
            <span className="text-ink-500 tabular-nums">{it.value}</span>
          </div>
          <ProgressBar value={it.value} total={max} color={it.color ?? '#E58AA1'} />
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// "This week within this month" nested bars — honest with the 7d ⊆ 30d data.
// ---------------------------------------------------------------------------

export function ActivityBars({
  rows,
}: {
  rows: { label: string; week: number; month: number }[]
}) {
  const max = Math.max(1, ...rows.map((r) => r.month))
  return (
    <div className="space-y-5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm text-ink-900">{r.label}</span>
            <span className="text-xs text-ink-500 tabular-nums">
              <span className="text-blush-600 font-medium">{r.week}</span> this
              week · {r.month} this month
            </span>
          </div>
          <div className="relative h-2.5 rounded-pill bg-surface-warm overflow-hidden">
            {/* 30-day total */}
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-line-input"
              style={{ width: `${(r.month / max) * 100}%` }}
            />
            {/* 7-day portion sits within it */}
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-blush-500"
              style={{ width: `${(r.week / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-4 pt-1 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-pill bg-blush-500" /> Last 7 days
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-pill bg-line-input" /> Last 30 days
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Completion ring — single-value progress ring (completed vs total sessions).
// This is the one deliberate blush chart series (design_handoff README).
// ---------------------------------------------------------------------------

export function CompletionRing({
  completed,
  total,
}: {
  completed: number
  total: number
}) {
  const pct = total > 0 ? completed / total : 0
  const r = 46
  const circumference = 2 * Math.PI * r
  const filled = pct * circumference

  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg viewBox="0 0 132 132" className="h-full w-full">
        <circle cx="66" cy="66" r={r} fill="none" stroke="#F4F1ED" strokeWidth="12" />
        {total > 0 && (
          <circle
            cx="66"
            cy="66"
            r={r}
            fill="none"
            stroke="#E58AA1"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
            transform="rotate(-90 66 66)"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-2xl leading-none text-ink-900 tabular-nums">
            {total > 0 ? `${Math.round(pct * 100)}%` : '—'}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">completed</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Content health panel — image coverage + publish-pipeline callout.
// ---------------------------------------------------------------------------

export function ContentHealthPanel({
  workoutImages,
  recipeImages,
  scheduledCount,
  gapCount,
}: {
  workoutImages: { covered: number; total: number }
  recipeImages: { covered: number; total: number }
  scheduledCount: number
  gapCount: number
}) {
  return (
    <div className="rounded-cardLg bg-white border border-line-card shadow-cardLg p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-display text-base font-bold text-ink-900">Content health</h2>
          <p className="text-xs text-ink-500 mt-1">
            What&apos;s ready for testers, and what still needs work
          </p>
        </div>
        {gapCount > 0 && (
          <span className="rounded-pill bg-warning-bg border border-warning-border px-3 py-1 text-[11px] font-medium text-warning whitespace-nowrap">
            {gapCount} gap{gapCount === 1 ? '' : 's'} to close
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <ImageCoverageRow label="Workout images" {...workoutImages} />
        <ImageCoverageRow label="Recipe images" {...recipeImages} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card bg-warning-bg border border-warning-border px-4 py-3">
        <p className="text-xs text-warning">
          {scheduledCount === 0 ? (
            <>Nothing is scheduled. No workouts or recipes have a publish date set.</>
          ) : (
            <>
              <span className="font-medium">{scheduledCount}</span> item
              {scheduledCount === 1 ? '' : 's'} scheduled for future publish.
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function ImageCoverageRow({
  label,
  covered,
  total,
}: {
  label: string
  covered: number
  total: number
}) {
  const isGap = covered < total
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-ink-900">{label}</span>
        <span className={`tabular-nums font-medium ${isGap ? 'text-error' : 'text-ink-900'}`}>
          {covered} / {total}
        </span>
      </div>
      <ProgressBar value={covered} total={total} color={isGap ? '#D9462F' : '#5F8D72'} />
      <p className="text-xs text-ink-500 mt-1.5">
        {isGap
          ? `${total - covered} ${label.toLowerCase()} missing`
          : 'Fully covered'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small inline stroke icons (2px, round caps — MOVED icon spec).
// ---------------------------------------------------------------------------

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const UsersIcon = () => (
  <svg {...iconProps}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

export const DumbbellIcon = () => (
  <svg {...iconProps}>
    <path d="M6.5 6.5 17.5 17.5M3 8v8M6 5v14M18 5v14M21 8v8" />
  </svg>
)

export const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const ClockIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const SparkIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </svg>
)

export const LayersIcon = () => (
  <svg {...iconProps}>
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </svg>
)
