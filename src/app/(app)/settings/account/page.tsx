import type { Metadata } from "next";

import { PasswordForm } from "@/components/auth/password-form";
import { getSession } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  // The layout already guarantees a session; this reads it for the email.
  const session = await getSession();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Minha conta</h1>
        {session && <p className="text-muted-foreground">Entrando como {session.email}</p>}
      </div>
      <section aria-labelledby="titulo-senha" className="space-y-4">
        <h2 id="titulo-senha" className="text-xl font-semibold tracking-tight">
          Trocar senha
        </h2>
        <PasswordForm />
      </section>
    </div>
  );
}
