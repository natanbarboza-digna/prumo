import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { CategoryList } from "@/components/categories/category-list";
import { Button } from "@/components/ui/button";
import { listCategories } from "@/modules/categories/service";

export const metadata: Metadata = { title: "Categorias de ação" };

export default async function CategoriesPage() {
  // No URL data is read here, so make the per-request rendering explicit.
  await connection();
  const categories = await listCategories();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-4">
        <Link href="/pdi" className="text-muted-foreground text-sm hover:underline">
          ← PDI
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">Categorias de ação</h1>
          <Button asChild>
            <Link href="/settings/categories/new">Nova categoria</Link>
          </Button>
        </div>
        <p className="text-muted-foreground">
          Classificam as ações de PDI. Categorias arquivadas não podem ser escolhidas em ações
          novas.
        </p>
      </div>
      {categories.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Nenhuma categoria cadastrada.</p>
          <Button asChild>
            <Link href="/settings/categories/new">Criar categoria</Link>
          </Button>
        </div>
      ) : (
        <CategoryList categories={categories} />
      )}
    </div>
  );
}
