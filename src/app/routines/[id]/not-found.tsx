import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function RoutineNotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Rotina não encontrada</h1>
      <p className="text-muted-foreground">Ela pode ter sido excluída.</p>
      <Button asChild>
        <Link href="/routines">Ver rotinas</Link>
      </Button>
    </section>
  );
}
