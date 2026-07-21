// Presentational pieces for the analytics dashboard. All server-safe (no
// client state), dependency-free — charts are hand-built SVG, matching how the
// MOVED iOS design system draws its progress rings.
//
// Colors come from the "Blush on White" v2 tokens + the workout-format accents
// documented in design-reference/design-tokens.md §1.

import type { ReactNode } from 'react'
import type { WorkoutFormat, WorkoutCategory, WorkoutSource } from '@/lib/types'

// Muted format accents (design-tokens.md §1 "Workout-format accents").
export const FORMAT_ACCENTS: Record<WorkoutFormat, string> = {
  Rounds: '#8D7BA6',
  AMRAP: '#C4704F',
  EMOM: '#7A92A5',
  'For Time': '#B76578',
  Tabata: '#6FA39B',
  Circuit: '#7E9770',
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

export const SOURCE_LABELS: Record<WorkoutSource, string> = {
  coach: 'Coach',
  aiGenerated: 'Gigi (AI)',
  saved: 'Saved',
  userCreated: 'User-built',
}

// ---------------------------------------------------------------------------
// Stat card — icon badge, label, big number, optional delta chip. The mini bar
// cluster on the right echoes the SalesPilot reference; here the bars are a
// small decorative sparkline scaled to the card's own trend values.
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  icon,
  delta,
  spark,
}: {
  label: string
  value: string
  icon: ReactNode
  delta?: { text: string; positive?: boolean }
  spark?: number[]
}) {
  return (
    <div className="rounded-card bg-white border border-blush-100 shadow-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center h-9 w-9 rounded-pill bg-blush-50 text-blush-600">
            {icon}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {label}
          </span>
        </div>
        {spark && spark.length > 0 && <SparkBars values={spark} />}
      </div>
      <div className="mt-4 font-display text-3xl leading-none text-ink-900 tabular-nums">
        {value}
      </div>
      {delta && (
        <div className="mt-2 text-xs text-ink-500">
          <span
            className={
              delta.positive === false
                ? 'text-ink-500 font-medium'
                : 'text-blush-600 font-medium'
            }
          >
            {delta.text}
          </span>
        </div>
      )}
    </div>
  )
}

function SparkBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex items-end gap-1 h-9" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="w-1.5 rounded-pill bg-blush-200"
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
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
      className={`rounded-card bg-white border border-blush-100 shadow-card p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-base text-ink-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
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
          strokeWidth="16"
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
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#f1ece6"
          strokeWidth="16"
        />
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
}: {
  items: { label: string; value: number; color: string }[]
}) {
  return (
    <ul className="flex-1 space-y-2.5 min-w-0">
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
// Horizontal proportion bars — used for category / source breakdowns.
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
          <div className="h-2 rounded-pill bg-blush-50 overflow-hidden">
            <div
              className="h-full rounded-pill"
              style={{
                width: `${(it.value / max) * 100}%`,
                backgroundColor: it.color ?? '#E58AA1',
                minWidth: it.value > 0 ? '0.5rem' : 0,
              }}
            />
          </div>
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
          <div className="relative h-2.5 rounded-pill bg-blush-50 overflow-hidden">
            {/* 30-day total */}
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-blush-200"
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
          <span className="h-2.5 w-2.5 rounded-pill bg-blush-200" /> Last 30 days
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Completion ring — single-value progress ring (completed vs total sessions).
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
        <circle cx="66" cy="66" r={r} fill="none" stroke="#f1ece6" strokeWidth="12" />
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
