import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CycleNotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Ciclo não encontrado</h1>
      <p className="text-muted-foreground">Ele pode ter sido excluído.</p>
      <Button asChild>
        <Link href="/pdi">Ver ciclos</Link>
      </Button>
    </section>
  );
}
