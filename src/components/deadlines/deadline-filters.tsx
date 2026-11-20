import Link from "next/link";

import { cn } from "@/lib/utils";
import { deadlineKindFilterLabels, deadlinePeriodLabels } from "@/modules/dashboard/labels";
import {
  DEADLINE_KIND_FILTERS,
  DEADLINE_PERIODS,
  type DeadlineKindFilter,
  type DeadlinePeriod,
} from "@/modules/dashboard/schemas";

type Filters = { period: DeadlinePeriod; kind: DeadlineKindFilter };

/** /deadlines with these filters; defaults stay out of the URL. */
function deadlinesHref({ period, kind }: Filters): string {
  const params = new URLSearchParams();
  if (period !== "30") params.set("periodo", period);
  if (kind !== "ALL") params.set("tipo", kind);
  const query = params.toString();
  return query ? `/deadlines?${query}` : "/deadlines";
}

/** Period and kind filters of the deadlines page (plan 028); each keeps the other. */
export function DeadlineFilters({ period, kind }: Filters) {
  return (
    <div className="space-y-3">
      <FilterLinks
        label="Período"
        options={DEADLINE_PERIODS.map((value) => ({
          key: value,
          text: deadlinePeriodLabels[value],
          href: deadlinesHref({ period: value, kind }),
          active: value === period,
        }))}
      />
      <FilterLinks
        label="Tipo"
        options={DEADLINE_KIND_FILTERS.map((value) => ({
          key: value,
          text: deadlineKindFilterLabels[value],
          href: deadlinesHref({ period, kind: value }),
          active: value === kind,
        }))}
      />
    </div>
  );
}

function FilterLinks({
  label,
  options,
}: {
  label: string;
  options: { key: string; text: string; href: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={option.href}
              aria-current={option.active ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]",
                option.active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {option.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
