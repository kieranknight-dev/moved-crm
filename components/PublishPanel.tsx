'use client'

import type { PublishMode } from '@/lib/builder'

// Generic publish-mode selector: draft / schedule / publish. Shared between
// the Workout Builder and Recipe Builder — this component only deals in
// status/publish_at semantics via PublishMode, nothing content-specific.
const PUBLISH_OPTIONS: { mode: PublishMode; label: string; hint: string }[] = [
  { mode: 'publish', label: 'Publish now', hint: 'Goes live in the app immediately.' },
  { mode: 'schedule', label: 'Schedule', hint: 'Goes live automatically at a set time.' },
  { mode: 'draft', label: 'Draft', hint: 'Saved to the library, hidden from the app.' },
]

export function PublishPanel({
  mode,
  setMode,
  scheduledLocal,
  setScheduledLocal,
}: {
  mode: PublishMode
  setMode: (m: PublishMode) => void
  scheduledLocal: string
  setScheduledLocal: (v: string) => void
}) {
  const active = PUBLISH_OPTIONS.find((o) => o.mode === mode)!
  // Minimum selectable time: one minute from now, in local datetime-local format.
  const min = new Date(Date.now() + 60_000).toISOString().slice(0, 16)
  return (
    <div className="mt-8 pt-6 border-t border-blush-100">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-300">
        Publish
      </span>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {PUBLISH_OPTIONS.map((o) => (
          <button
            key={o.mode}
            type="button"
            onClick={() => setMode(o.mode)}
            className={`rounded-card border px-3 py-2.5 text-sm font-medium transition-colors ${
              mode === o.mode
                ? 'border-blush-500 bg-blush-50 text-blush-700'
                : 'border-blush-100 text-ink-500 hover:border-blush-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-500">{active.hint}</p>
      {mode === 'schedule' && (
        <input
          type="datetime-local"
          value={scheduledLocal}
          min={min}
          onChange={(e) => setScheduledLocal(e.target.value)}
          className="mt-3 rounded-card border border-blush-100 bg-white px-4 py-2.5 text-sm outline-none focus:border-blush-500 transition-colors"
        />
      )}
    </div>
  )
}
