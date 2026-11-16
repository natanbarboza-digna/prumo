import Link from "next/link";

import { cn } from "@/lib/utils";

const options = [
  { label: "Ativas", state: "active", href: "/routines" },
  { label: "Encerradas", state: "ended", href: "/routines?state=ended" },
] as const;

export function RoutineFilter({ current }: { current: "active" | "ended" }) {
  return (
    <nav aria-label="Filtrar rotinas">
      <ul className="flex flex-wrap gap-2">
        {options.map(({ label, state, href }) => {
          const active = state === current;
          return (
            <li key={state}>
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
