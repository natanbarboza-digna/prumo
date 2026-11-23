import Link from "next/link";

import { cn } from "@/lib/utils";
import { bookFilterLabels } from "@/modules/books/labels";
import { BOOK_FILTERS, type BookFilter as Filter } from "@/modules/books/rules";

/** Filter links of the book list (plan 035), like the track list's. */
export function BookFilter({ current }: { current: Filter }) {
  return (
    <nav aria-label="Filtrar livros">
      <ul className="flex flex-wrap gap-2">
        {BOOK_FILTERS.map((filter) => {
          const active = filter === current;
          return (
            <li key={filter}>
              <Link
                href={filter === "SHELF" ? "/books" : `/books?situacao=${filter}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {bookFilterLabels[filter]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
