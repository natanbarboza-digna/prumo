import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/brand-mark";
import { safeNextPath } from "@/modules/auth/redirect";
import { getSession } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = safeNextPath(typeof next === "string" ? next : null);
  // Already logged in: nothing to do here.
  if (await getSession()) redirect(target);

  return (
    <main id="conteudo" className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark className="size-8" />
          <h1 className="text-3xl font-semibold tracking-tight">Entrar no Prumo</h1>
        </div>
        <LoginForm next={target} />
      </div>
    </main>
  );
}
