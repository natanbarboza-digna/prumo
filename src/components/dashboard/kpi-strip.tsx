import Link from "next/link";

import { cn } from "@/lib/utils";
import { kpiItems } from "@/modules/dashboard/labels";
import type { DashboardKpis } from "@/modules/dashboard/rules";

/** The five numbers at the top of the dashboard (plan 034), each a link to its screen. */
export function KpiStrip({ kpis }: { kpis: DashboardKpis }) {
  return (
    <section aria-label="Indicadores">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpiItems(kpis).map((item) => (
          // Five in two columns: the last one takes the whole row on phones.
          <li key={item.label} className="last:col-span-2 lg:last:col-span-1">
            <Link
              href={item.href}
              className="bg-card hover:bg-accent focus-visible:ring-ring flex h-full flex-col gap-1 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {/* The link reads "Prazos atrasados 2", from its own text. */}
              <span className="text-muted-foreground text-sm">{item.label}</span>
              <span
                className={cn(
                  "text-2xl font-semibold tracking-tight tabular-nums",
                  item.alert && "text-destructive",
                )}
              >
                {item.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
