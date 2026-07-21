import { createAdminClient } from '@/lib/supabase/admin'
import RecipeLibraryTable, { type RecipeLibraryRow } from './RecipeLibraryTable'

// Admin-only view of ALL recipes, including drafts and scheduled recipes the
// app can't see — reads via the service-role admin client (bypasses RLS; the
// CRM is already gated to admins by middleware). Mirrors /library exactly.
export const dynamic = 'force-dynamic'

export default async function RecipeLibraryPage() {
  const supabase = createAdminClient()

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select(
      'id, name, category, status, publish_at, image_url, servings, difficulty, prep_minutes, created_at'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div>
        <h1 className="font-display text-2xl mb-4">Recipes</h1>
        <div className="rounded-card bg-blush-50 border border-blush-200 p-4 text-sm text-blush-700">
          Couldn&apos;t load recipes. ({error.message})
        </div>
      </div>
    )
  }

  return <RecipeLibraryTable recipes={(recipes ?? []) as RecipeLibraryRow[]} />
}
