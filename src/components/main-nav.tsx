"use client";
// Client Component: usePathname reads the current URL in the browser, which is
// how the active link gets aria-current="page".

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

const links = [{ href: "/goals", label: "Objetivos" }];

export function MainNav() {
  // The URL is per-request data, so Next requires reading it inside Suspense.
  // The fallback is the same nav without the active highlight, so the header
  // never jumps while the current path streams in.
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNavLinks />
    </Suspense>
  );
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Principal">
      <ul className="flex items-center gap-1">
        {links.map(({ href, label }) => {
          const active =
            pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-[3px]",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
