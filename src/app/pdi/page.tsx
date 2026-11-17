import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { CycleList } from "@/components/pdi/cycle-list";
import { Button } from "@/components/ui/button";
import { listCycles } from "@/modules/pdi/service";

export const metadata: Metadata = { title: "PDI" };

export default async function PdiPage() {
  // No URL data is read here, so make the per-request rendering explicit.
  await connection();
  const cycles = await listCycles();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">PDI</h1>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/settings/categories">Gerenciar categorias</Link>
          </Button>
          <Button asChild>
            <Link href="/pdi/new">Novo ciclo</Link>
          </Button>
        </div>
      </div>
      {cycles.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Nenhum ciclo de PDI cadastrado.</p>
          <Button asChild>
            <Link href="/pdi/new">Criar ciclo</Link>
          </Button>
        </div>
      ) : (
        <CycleList cycles={cycles} />
      )}
    </div>
  );
}
