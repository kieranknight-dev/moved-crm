import { createAdminClient } from '@/lib/supabase/admin'
import LibraryTable, { type LibraryRow } from './LibraryTable'

// Admin-only view of ALL coach content, including drafts and scheduled
// workouts the app can't see — reads via the service-role admin client
// (bypasses RLS; the CRM is already gated to admins by middleware). Scoped to
// source='coach'. Filtering + row actions live in the LibraryTable client.
export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const supabase = createAdminClient()

  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id, title, format, category, difficulty, status, publish_at, created_at')
    .eq('source', 'coach')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div>
        <h1 className="font-display text-2xl mb-4">Workouts</h1>
        <div className="rounded-card bg-blush-50 border border-blush-200 p-4 text-sm text-blush-700">
          Couldn&apos;t load workouts. ({error.message})
        </div>
      </div>
    )
  }

  return <LibraryTable workouts={(workouts ?? []) as LibraryRow[]} />
}
