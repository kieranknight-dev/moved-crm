import { createAdminClient } from '@/lib/supabase/admin'
import { publishInitFromStatus } from '@/lib/builder'
import RecipeBuilder, { type RecipeBuilderInit } from './RecipeBuilder'

// Admin-only page: the Recipe Builder form (create, or edit with ?id=). Reads
// via the service-role admin client (same as /builder) since a draft/scheduled
// recipe isn't RLS-visible even to admins. Existing recipes are listed and
// managed on /recipe-library. Dynamic so an edit always loads fresh data.
export const dynamic = 'force-dynamic'

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  let init: RecipeBuilderInit | undefined

  if (searchParams.id) {
    const admin = createAdminClient()
    const { data: recipe } = await admin
      .from('recipes')
      .select('*')
      .eq('id', searchParams.id)
      .single()
    if (recipe) {
      const publish = publishInitFromStatus(recipe.status, recipe.publish_at)
      init = {
        recipeId: recipe.id,
        form: {
          name: recipe.name,
          category: recipe.category as RecipeBuilderInit['form']['category'],
          imageUrl: recipe.image_url,
          prepMinutes: recipe.prep_minutes,
          difficulty: recipe.difficulty as RecipeBuilderInit['form']['difficulty'],
          servings: recipe.servings,
          dietaryTags: recipe.dietary_tags ?? [],
          ingredients: (recipe.ingredients as string[] | null)?.length
            ? (recipe.ingredients as string[])
            : [''],
          steps: (recipe.steps as string[] | null)?.length ? (recipe.steps as string[]) : [''],
          isPremium: recipe.is_premium,
        },
        publishMode: publish.mode,
        scheduledLocal: publish.scheduledLocal,
      }
    }
  }

  return <RecipeBuilder init={init} />
}
