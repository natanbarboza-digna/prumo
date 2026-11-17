import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CategoryNotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Categoria não encontrada</h1>
      <p className="text-muted-foreground">Ela pode ter sido excluída.</p>
      <Button asChild>
        <Link href="/settings/categories">Ver categorias</Link>
      </Button>
    </section>
  );
}
