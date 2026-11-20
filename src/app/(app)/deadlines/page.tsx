import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { useId } from "react";

import { DeadlineFilters } from "@/components/deadlines/deadline-filters";
import { DeadlineItem } from "@/components/deadlines/deadline-item";
import { todayInAppTimeZone } from "@/lib/dates";
import { deadlinesEmptyText, weekTitle } from "@/modules/dashboard/labels";
import { type Deadline, groupDeadlinesByWeek } from "@/modules/dashboard/rules";
import {
  deadlineKindFilterSchema,
  deadlinePeriodSchema,
  periodDays,
} from "@/modules/dashboard/schemas";
import { listDeadlines } from "@/modules/dashboard/service";

export const metadata: Metadata = { title: "Prazos" };

/** Every deadline (plan 028), overdue first and then by week. Opened from the dashboard. */
export default async function DeadlinesPage({ searchParams }: PageProps<"/deadlines">) {
  const query = await searchParams;
  const period = deadlinePeriodSchema.parse(query.periodo);
  const kind = deadlineKindFilterSchema.parse(query.tipo);
  // "Today" is read before the database, so tell Next this page renders per
  // request instead of prerendering a frozen clock.
  await connection();
  const today = todayInAppTimeZone();
  const all = await listDeadlines();
  const items = kind === "ALL" ? all : all.filter((item) => item.kind === kind);
  const { overdue, weeks } = groupDeadlinesByWeek(items, today, {
    periodDays: periodDays(period),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/" className="text-muted-foreground text-sm hover:underline">
          ← Painel
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Prazos</h1>
        <p className="text-muted-foreground">
          Etapas de trilha, ações de PDI e objetivos em aberto com data.
        </p>
      </div>

      <DeadlineFilters period={period} kind={kind} />

      {overdue.length === 0 && weeks.length === 0 ? (
        <p>
          {deadlinesEmptyText(period)}{" "}
          {period !== "all" && (
            <Link
              href={
                kind === "ALL" ? "/deadlines?periodo=all" : `/deadlines?periodo=all&tipo=${kind}`
              }
              className="underline underline-offset-4"
            >
              Ver todos
            </Link>
          )}
        </p>
      ) : (
        <div className="space-y-8">
          <Group title="Atrasados" items={overdue} today={today} />
          {weeks.map((week) => (
            <Group
              key={week.monday}
              title={weekTitle(week.monday, week.sunday, today)}
              items={week.items}
              today={today}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ title, items, today }: { title: string; items: Deadline[]; today: string }) {
  // Unique per instance: Next may keep a hidden copy of the page with other filters.
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-xl font-semibold tracking-tight">
        {title} ({items.length})
      </h2>
      <ul className="grid gap-2" aria-label={title}>
        {items.map((item) => (
          <DeadlineItem key={`${item.kind}-${item.id}`} item={item} today={today} />
        ))}
      </ul>
    </section>
  );
}
