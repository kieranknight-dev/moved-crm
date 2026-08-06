// Shared shell for the two builders (New Workout, New Recipe): a two-column
// layout with the publish controls in a sticky right panel instead of a
// floating bottom bar, plus the small presentational pieces (form card,
// summary card, warning strip) both builders compose it from.

import type { ReactNode } from 'react'

export function BuilderShell({
  form,
  sidebar,
}: {
  form: ReactNode
  sidebar: ReactNode
}) {
  return (
    <div className="grid grid-cols-1 min-[1100px]:grid-cols-[1fr_320px] gap-7 items-start">
      <div className="min-w-0">{form}</div>
      <div className="min-[1100px]:sticky min-[1100px]:top-9 space-y-5">{sidebar}</div>
    </div>
  )
}

export function FormCard({
  title,
  action,
  children,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-card bg-white border border-line-card shadow-card p-6">
      {title && (
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-[17px] font-bold text-ink-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function SummaryCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card bg-white border border-line-card shadow-card p-6">
      <h2 className="font-display text-[15px] font-bold text-ink-900 mb-3">Summary</h2>
      <dl className="text-sm divide-y divide-line-divider">{children}</dl>
    </div>
  )
}

export function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900 font-medium text-right">{value}</dd>
    </div>
  )
}

export function WarningStrip({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-card bg-warning-bg border border-warning-border px-3.5 py-2.5 text-xs text-warning">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-px shrink-0"
      >
        <path d="M12 9v4M12 16.5v.01" />
        <path d="M10.3 3.9 2.6 17.5a1.6 1.6 0 0 0 1.4 2.4h16a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      </svg>
      {children}
    </p>
  )
}
