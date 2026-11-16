import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Shown instead of an edit form when the cycle is closed (read-only). */
export function ClosedCycleNotice({ cycleId, heading }: { cycleId: string; heading: string }) {
  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      <p className="text-muted-foreground">
        Este ciclo está encerrado e é somente leitura. Reabra o ciclo para fazer alterações.
      </p>
      <Button asChild>
        <Link href={`/pdi/${cycleId}`}>Voltar ao ciclo</Link>
      </Button>
    </section>
  );
}
