import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ActionNotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Ação não encontrada</h1>
      <p className="text-muted-foreground">
        Ela pode ter sido excluída ou pertencer a outro ciclo.
      </p>
      <Button asChild>
        <Link href="/pdi">Ver ciclos</Link>
      </Button>
    </section>
  );
}
