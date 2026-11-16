import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/categories/category-form";
import { updateCategoryAction } from "@/modules/categories/actions";
import { CategoryNotFoundError, getCategory } from "@/modules/categories/service";

export const metadata: Metadata = { title: "Editar categoria" };

export default async function EditCategoryPage({
  params,
}: PageProps<"/settings/categories/[id]/edit">) {
  const category = await loadCategory((await params).id);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Editar categoria</h1>
      <CategoryForm
        action={updateCategoryAction.bind(null, category.id)}
        defaultValues={{ name: category.name, allowsRoutine: category.allowsRoutine }}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}

async function loadCategory(id: string) {
  try {
    return await getCategory(id);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) notFound();
    throw error;
  }
}
