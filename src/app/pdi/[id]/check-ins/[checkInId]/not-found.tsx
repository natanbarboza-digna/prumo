import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function CheckInNotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Check-in não encontrado</h1>
      <p className="text-muted-foreground">
        Ele pode ter sido excluído ou pertencer a outro ciclo.
      </p>
      <Button asChild>
        <Link href="/pdi">Ver ciclos</Link>
      </Button>
    </section>
  );
}
