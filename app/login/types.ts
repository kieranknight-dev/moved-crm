// Kept out of actions.ts: a 'use server' module may only export async
// functions, so the shared form-state type lives here instead.
export type LoginState = { error: string | null }
