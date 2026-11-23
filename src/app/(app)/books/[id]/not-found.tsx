import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function BookNotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Livro não encontrado</h1>
      <p className="text-muted-foreground">Ele pode ter sido excluído.</p>
      <Button asChild>
        <Link href="/books">Ver livros</Link>
      </Button>
    </section>
  );
}
