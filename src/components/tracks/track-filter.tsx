import Link from "next/link";

import { cn } from "@/lib/utils";
import { trackFilterLabels } from "@/modules/tracks/labels";
import { TRACK_FILTERS, type TrackFilter as Filter } from "@/modules/tracks/schemas";

/** Filter links of the track list (plan 024), like the goal list's. */
export function TrackFilter({ current }: { current: Filter }) {
  return (
    <nav aria-label="Filtrar trilhas">
      <ul className="flex flex-wrap gap-2">
        {TRACK_FILTERS.map((filter) => {
          const active = filter === current;
          return (
            <li key={filter}>
              <Link
                href={filter === "ACTIVE" ? "/tracks" : `/tracks?situacao=${filter}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {trackFilterLabels[filter]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
