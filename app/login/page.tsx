'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { login } from './actions'
import type { LoginState } from './types'

const initialState: LoginState = { error: null }

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

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const [state, formAction] = useFormState(login, initialState)

  const message =
    state.error ??
    (searchParams.error === 'unauthorized'
      ? 'That account isn’t authorised for the MOVED. CRM.'
      : null)

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="font-display text-3xl tracking-tight mb-1 text-ink-900">
          MOVED<span className="text-blush-500">.</span>
        </div>
        <p className="text-sm text-ink-500 mb-8">Workout CMS — admin sign in.</p>

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
              required
              className="w-full rounded-card border border-blush-100 bg-white px-4 py-3 text-sm outline-none focus:border-blush-500 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[11px] font-medium uppercase tracking-wide text-ink-500 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-card border border-blush-100 bg-white px-4 py-3 text-sm outline-none focus:border-blush-500 transition-colors"
            />
          </div>

          {message && (
            <p className="text-sm text-blush-700 bg-blush-50 border border-blush-100 rounded-card px-4 py-3">
              {message}
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
