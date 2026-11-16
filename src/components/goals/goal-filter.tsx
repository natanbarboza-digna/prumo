import Link from "next/link";

import type { GoalStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { goalStatusLabels, goalStatusOrder } from "@/modules/goals/labels";

const options: { label: string; status?: GoalStatus }[] = [
  { label: "Ativos" },
  ...goalStatusOrder.map((status) => ({ label: goalStatusLabels[status], status })),
];

export function GoalFilter({ current }: { current?: GoalStatus }) {
  return (
    <nav aria-label="Filtrar por status">
      <ul className="flex flex-wrap gap-2">
        {options.map(({ label, status }) => {
          const active = status === current;
          return (
            <li key={label}>
              <Link
                href={status ? `/goals?status=${status}` : "/goals"}
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
