'use client'

import type { ReactNode } from 'react'
import { isoToLocalInput, type PublishMode } from '@/lib/builder'

// Generic publish-mode selector: draft / schedule / publish. Shared between
// the Workout Builder and Recipe Builder — this component only deals in
// status/publish_at semantics via PublishMode, nothing content-specific.
const PUBLISH_OPTIONS: { mode: PublishMode; label: string; hint: string }[] = [
  { mode: 'publish', label: 'Publish now', hint: 'Goes live immediately.' },
  { mode: 'schedule', label: 'Schedule', hint: 'Pick a date and time.' },
  { mode: 'draft', label: 'Save as draft', hint: 'Hidden from the app.' },
]

function CheckDot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${
        checked ? 'border-blush-500 bg-blush-500' : 'border-line-input bg-white'
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 6 9 17l-5-5"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}

export function PublishPanel({
  mode,
  setMode,
  scheduledLocal,
  setScheduledLocal,
  status,
  children,
}: {
  mode: PublishMode
  setMode: (m: PublishMode) => void
  scheduledLocal: string
  setScheduledLocal: (v: string) => void
  status?: ReactNode
  children?: ReactNode
}) {
  // Minimum selectable time: one minute from now, in Sydney wall-clock time
  // (datetime-local's value is compared as local time, so this must be
  // formatted the same way scheduling itself is interpreted — see
  // localInputToIso/isoToLocalInput in lib/builder.ts).
  const min = isoToLocalInput(new Date(Date.now() + 60_000).toISOString())
  return (
    <div className="rounded-card bg-white border border-line-card shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-[15px] font-bold text-ink-900">Publish</h2>
        {status}
      </div>
      <div className="space-y-2">
        {PUBLISH_OPTIONS.map((o) => (
          <label
            key={o.mode}
            className={`flex items-start gap-3 rounded-[14px] border-[1.5px] px-4 py-3 cursor-pointer transition-colors ${
              mode === o.mode ? 'border-blush-500 bg-blush-50' : 'border-line-input hover:bg-surface-warm'
            }`}
          >
            <input
              type="radio"
              name="publish-mode"
              className="sr-only"
              checked={mode === o.mode}
              onChange={() => setMode(o.mode)}
            />
            <CheckDot checked={mode === o.mode} />
            <span>
              <span className="block text-sm font-medium text-ink-900">{o.label}</span>
              <span className="block text-xs text-ink-500 mt-0.5">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {mode === 'schedule' && (
        <input
          type="datetime-local"
          value={scheduledLocal}
          min={min}
          onChange={(e) => setScheduledLocal(e.target.value)}
          className="mt-3 w-full rounded-xl border border-line-input bg-surface-input px-4 py-2.5 text-sm outline-none focus:border-blush-500 focus:ring-[3px] focus:ring-blush-500/15 transition-colors"
        />
      )}
      {children}
    </div>
  )
}
