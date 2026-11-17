import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function TrackNotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Trilha não encontrada</h1>
      <p className="text-muted-foreground">Ela pode ter sido excluída.</p>
      <Button asChild>
        <Link href="/tracks">Ver trilhas</Link>
      </Button>
    </section>
  );
}
