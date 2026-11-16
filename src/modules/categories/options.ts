import { listCategories } from "@/modules/categories/service";

/**
 * Categories offered in the action form: the active ones, plus the action's
 * current category when it was archived later (an action may keep it).
 */
export async function categoryOptions(
  currentId?: string,
): Promise<{ id: string; label: string }[]> {
  const categories = await listCategories();
  return categories
    .filter((category) => !category.archived || category.id === currentId)
    .map((category) => ({
      id: category.id,
      label: category.archived ? `${category.name} (arquivada)` : category.name,
    }));
}
