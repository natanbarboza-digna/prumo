"use client"; // Error boundaries must be Client Components (they use React state).

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  // Anything can be thrown in JavaScript, so Next types it as `unknown`.
  error: unknown;
  retry: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <p className="text-muted-foreground">
        Não foi possível carregar esta página. Tente de novo; se o problema continuar, veja o log do
        servidor.
      </p>
      <Button type="button" onClick={() => retry()}>
        Tentar de novo
      </Button>
    </section>
  );
}
