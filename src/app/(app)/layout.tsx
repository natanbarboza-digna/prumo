import { Search, UserRound } from "lucide-react";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { BrandMark } from "@/components/brand-mark";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/modules/auth/session";

/**
 * Validates the session in the database and only then renders the page, so a
 * forged or expired cookie never gets to see data (the proxy only checks that
 * the cookie exists). It sits inside <Suspense>: with Cache Components, a
 * session read at the top of a layout would hold every navigation behind it.
 */
async function SessionGate({ children }: { children: ReactNode }) {
  await requireSession();
  return children;
}

/** Every screen of the app (the (app) folder is a route group: it does not change the URLs). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b">
        {/* On phones the nav wraps to its own row under the brand (see MainNav);
            from md up everything sits on one row. */}
        <div className="mx-auto flex min-h-14 w-full max-w-5xl flex-wrap items-center gap-x-4 px-4 md:flex-nowrap">
          <Link
            href="/"
            aria-label="Prumo, página inicial"
            className="flex h-14 items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <BrandMark />
            Prumo
          </Link>
          <MainNav />
          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="icon">
              <Link href="/search" aria-label="Buscar">
                <Search aria-hidden="true" />
              </Link>
            </Button>
            <ThemeToggle />
            <Button asChild variant="ghost" size="icon">
              <Link href="/settings/account" aria-label="Minha conta">
                <UserRound aria-hidden="true" />
              </Link>
            </Button>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense
          fallback={
            <div role="status" aria-live="polite" className="text-muted-foreground">
              Carregando…
            </div>
          }
        >
          <SessionGate>{children}</SessionGate>
        </Suspense>
      </main>
    </>
  );
}
