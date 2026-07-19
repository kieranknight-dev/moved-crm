'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth'
import type { LoginState } from './types'

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Enter your email and password.' }
  }

  // Fail closed before touching Supabase — non-admins never get a session.
  if (!isAdminEmail(email)) {
    return { error: 'This email isn’t authorised for the MOVED. CRM.' }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Incorrect email or password.' }
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
