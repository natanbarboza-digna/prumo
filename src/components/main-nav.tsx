"use client";
// Client Component: usePathname reads the current URL in the browser, which is
// how the active link gets aria-current="page".

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

/** `sections`: URL prefixes where the item counts as the current page. */
const links = [
  { href: "/today", label: "Hoje", sections: ["/today"] },
  { href: "/goals", label: "Objetivos", sections: ["/goals"] },
  // Tracks, PDI and books share one item (plans 015 and 035); the tabs on their lists switch between them.
  { href: "/tracks", label: "Desenvolvimento", sections: ["/tracks", "/pdi", "/books"] },
  { href: "/routines", label: "Rotinas", sections: ["/routines"] },
  { href: "/time", label: "Tempo", sections: ["/time"] },
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
        {links.map(({ href, label, sections }) => {
          const active =
            pathname !== null &&
            sections.some((section) => pathname === section || pathname.startsWith(`${section}/`));
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // px-2 on phones: the four items (with "Desenvolvimento") fit in 375 px.
                  "focus-visible:ring-ring/50 block rounded-md px-2 py-2 text-sm outline-none focus-visible:ring-[3px] sm:px-3",
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
