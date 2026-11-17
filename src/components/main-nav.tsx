"use client";
// Client Component: usePathname reads the current URL in the browser, which is
// how the active link gets aria-current="page".

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/today", label: "Hoje" },
  { href: "/goals", label: "Objetivos" },
  { href: "/tracks", label: "Trilhas" },
  { href: "/routines", label: "Rotinas" },
  { href: "/pdi", label: "PDI" },
];

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
    // Phones: last in the header row, full width, one line that scrolls sideways
    // when it does not fit (320 px), so the page itself never does. md and up:
    // back between the brand and the theme button. Links are blocks so their
    // padding stays inside the strip instead of being clipped by the overflow.
    <nav
      aria-label="Principal"
      className="order-last w-full overflow-x-auto pt-1 pb-2 md:order-none md:w-auto md:overflow-visible md:py-0"
    >
      {/* The padding keeps the focus ring inside the scrolling strip. */}
      <ul className="flex items-center gap-1 px-1 md:px-0">
        {links.map(({ href, label }) => {
          const active =
            pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 block rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-[3px]",
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
