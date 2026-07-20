import { createAdminClient } from '@/lib/supabase/admin'
import RecipeBuilder, { type RecipeListItem } from './RecipeBuilder'

// Admin-only page: form to add a recipe + a list of existing ones. Reads via
// the service-role admin client (same as /library) — the CRM is already gated
// to admins by middleware. Dynamic so the list is fresh after each add.
export const dynamic = 'force-dynamic'

export default async function RecipesPage() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, category, image_url')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink-900 mb-2">New recipe</h1>
        <p className="rounded-card bg-blush-50 border border-blush-100 px-4 py-3 text-sm text-blush-700">
          Couldn’t load recipes ({error.message}).
        </p>
      </div>
    )
  }

  return <RecipeBuilder recipes={(data ?? []) as RecipeListItem[]} />
}
