'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'
import type { LoginState } from './types'

const initialState: LoginState = { error: null }

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

function EyeIcon({ off }: { off: boolean }) {
  if (off) {
    return (
      <svg {...iconProps}>
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.7 18.7 0 0 1 4.22-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <path d="M1 1l22 22" />
      </svg>
    )
  }
  return (
    <svg {...iconProps}>
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#D9462F" />
      <path d="M12 7v6M12 16.5v.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-pill bg-blush-500 text-white py-3 text-sm font-medium shadow-cta hover:shadow-cardHover transition-shadow disabled:opacity-60"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  )
}

const inputClass =
  'w-full min-h-[50px] rounded-xl border border-line-input bg-surface-input px-4 text-sm outline-none focus:border-blush-500 focus:ring-[3px] focus:ring-blush-500/15 transition-colors'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const [state, formAction] = useFormState(login, initialState)
  const [showPassword, setShowPassword] = useState(false)

  const message =
    state.error ??
    (searchParams.error === 'unauthorized'
      ? 'That account isn’t authorised for the MOVED. CRM.'
      : null)

  return (
    <div className="min-h-screen flex bg-surface-page">
      <div className="flex-1 grid place-items-center p-6">
        <div className="w-full max-w-[380px]">
          <div className="font-display text-3xl tracking-tight mb-1 text-ink-900">
            MOVED<span className="text-blush-500">.</span>
          </div>
          <p className="text-sm text-ink-500 mb-8">Workout CMS — admin sign in.</p>

          <div className="rounded-cardLg bg-white shadow-cardLg p-7">
            <form action={formAction} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-[11px] font-medium uppercase tracking-wide text-ink-500 mb-1.5"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@moved.app"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-[11px] font-medium uppercase tracking-wide text-ink-500 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3.5 text-ink-500 hover:text-ink-900 transition-colors"
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </div>

              {message && (
                <p className="flex items-start gap-2 text-sm text-error-text bg-error-tint border border-error-border rounded-card px-4 py-3">
                  <span className="mt-0.5 shrink-0">
                    <ErrorIcon />
                  </span>
                  {message}
                </p>
              )}

              <SubmitButton />
            </form>
          </div>

          <p className="text-xs text-ink-500 mt-6 text-center">
            Admin accounts only. Contact Kieran if you need access.
          </p>
        </div>
      </div>

      <div className="hidden min-[900px]:flex w-[520px] bg-blush-50 flex-col justify-center p-14">
        <span className="text-xs font-semibold uppercase tracking-wide text-blush-600">
          MOVED. CRM
        </span>
        <h2 className="font-display text-3xl font-bold text-ink-900 mt-3 leading-tight">
          Workouts and recipes, live in the hands of your testers.
        </h2>
      </div>
    </div>
  )
}
