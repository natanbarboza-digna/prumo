import Link from "next/link";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/tracks", label: "Trilhas" },
  { href: "/pdi", label: "PDI" },
] as const;

/**
 * Trilhas | PDI at the top of the two lists of the "Desenvolvimento" menu item
 * (plan 015). They are links, not a tablist: each tab is its own page with its
 * own URL. A Server Component: each page says which tab it is, so no URL needs
 * to be read in the browser.
 */
export function DevelopmentTabs({ current }: { current: (typeof tabs)[number]["href"] }) {
  return (
    <nav aria-label="Desenvolvimento">
      <ul className="flex gap-2">
        {tabs.map(({ href, label }) => {
          const active = href === current;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent hover:text-accent-foreground",
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
