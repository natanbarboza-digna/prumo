import type { Metadata } from "next";

import { CategoryForm } from "@/components/categories/category-form";
import { createCategoryAction } from "@/modules/categories/actions";

export const metadata: Metadata = { title: "Nova categoria" };

export default function NewCategoryPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nova categoria</h1>
      <CategoryForm action={createCategoryAction} submitLabel="Criar categoria" />
    </div>
  );
}
