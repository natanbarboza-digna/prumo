import Link from "next/link";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { SEARCH_GROUPS, groupHeading, moreText, storedBadge } from "@/modules/search/labels";
import type { SearchResults as Results } from "@/modules/search/service";

/** The groups that matched (plan 027), in the fixed order; empty groups are left out. */
export function SearchResults({ term, results }: { term: string; results: Results }) {
  const groups = SEARCH_GROUPS.filter((key) => results[key].total > 0);
  // Unique per instance: Next may keep a hidden copy of an earlier search page.
  const baseId = useId();

  if (groups.length === 0) {
    return <p role="status">Nada encontrado para “{term}”.</p>;
  }

  return (
    <div className="space-y-8">
      {groups.map((key) => {
        const { items, total } = results[key];
        const headingId = `${baseId}-${key.toLowerCase()}`;
        return (
          <section key={key} aria-labelledby={headingId} className="space-y-3">
            <h2 id={headingId} className="text-xl font-semibold tracking-tight">
              {groupHeading(key, total)}
            </h2>
            <ul className="grid gap-2">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={item.href} className="font-medium break-words hover:underline">
                      {item.title}
                    </Link>
                    {item.stored && <Badge variant="outline">{storedBadge[key]}</Badge>}
                  </div>
                  {item.context && (
                    <p className="text-muted-foreground text-sm break-words">{item.context}</p>
                  )}
                </li>
              ))}
            </ul>
            {total > items.length && (
              <p className="text-muted-foreground text-sm">{moreText(key, total - items.length)}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
