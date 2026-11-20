import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Shown instead of an edit form when the track is archived (read-only, plan 024). */
export function ArchivedTrackNotice({ trackId, heading }: { trackId: string; heading: string }) {
  return (
    <section className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">{heading}</h1>
      <p className="text-muted-foreground">
        Esta trilha está arquivada e é somente leitura. Desarquive a trilha para fazer alterações.
      </p>
      <Button asChild>
        <Link href={`/tracks/${trackId}`}>Voltar à trilha</Link>
      </Button>
    </section>
  );
}
