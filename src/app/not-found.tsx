import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço que você abriu não existe ou foi removido.</p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </section>
  );
}
