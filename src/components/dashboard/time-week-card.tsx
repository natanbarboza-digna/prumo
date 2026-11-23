import { useId } from "react";

import { DashboardCard, EmptyCardText } from "@/components/dashboard/dashboard-card";
import { formatDateForDisplay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CategoryShare } from "@/modules/dashboard/rules";
import type { DashboardTimeWeek } from "@/modules/dashboard/service";
import { weekdayShortLabels } from "@/modules/routines/labels";
import { durationText } from "@/modules/time/labels";

// Whole class names, so Tailwind finds them in the source.
const TONES: Record<number, string> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
};

/** "Outras" is gray: the five tones stay for the biggest categories. */
function toneClass(share: CategoryShare): string {
  return share.tone === null ? "bg-muted-foreground/50" : (TONES[share.tone] ?? "");
}

const hours = (minutes: number) => (minutes === 0 ? "0h" : durationText(minutes));

/**
 * The week's time (plan 034): hours worked per day and the work by category,
 * from the analytics' sums. Bars in plain CSS and decorative; the numbers are
 * also in a table hidden only visually and in the legend. A Server Component.
 */
export function TimeWeekCard({ week }: { week: DashboardTimeWeek }) {
  return (
    <DashboardCard
      id="tempo"
      title="Tempo da semana"
      more={{ href: "/time/analytics", label: "Ver analíticos" }}
    >
      {week.days === 0 ? (
        <EmptyCardText
          text="Nenhum registro de tempo esta semana."
          href="/time"
          label="Abrir Tempo"
        />
      ) : (
        <div className="space-y-6">
          <p className="text-sm">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {hours(week.worked)}
            </span>{" "}
            <span className="text-muted-foreground">
              trabalhadas em {week.days} {week.days === 1 ? "dia" : "dias"}
            </span>
          </p>
          <DayBars week={week} />
          {week.categories.length > 0 && <CategoryBar categories={week.categories} />}
        </div>
      )}
    </DashboardCard>
  );
}

function DayBars({ week }: { week: DashboardTimeWeek }) {
  // useId keeps the id unique even when Next keeps a hidden copy of the page.
  const titleId = useId();
  return (
    <figure aria-labelledby={titleId} className="space-y-2">
      <figcaption id={titleId} className="text-sm font-medium">
        Horas trabalhadas por dia
      </figcaption>
      <div aria-hidden="true" className="flex items-end gap-1 sm:gap-2">
        {week.bars.map((bar) => (
          <div key={bar.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {bar.isFuture ? " " : hours(bar.minutes)}
            </span>
            <div className="bg-muted flex h-24 w-full items-end overflow-hidden rounded-sm">
              {bar.minutes > 0 && (
                // The height is the data itself, so it goes inline instead of a class.
                <div
                  className={cn("w-full", bar.isToday ? "bg-chart-1" : "bg-chart-1/60")}
                  style={{ height: `${bar.height}%` }}
                />
              )}
            </div>
            <span
              className={cn("text-xs", bar.isToday ? "font-semibold" : "text-muted-foreground")}
            >
              {weekdayShortLabels[bar.weekday]}
            </span>
          </div>
        ))}
      </div>
      {/* sr-only on a wrapper, never on the table itself (plan 029). */}
      <div className="sr-only">
        <table>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Trabalhado</th>
            </tr>
          </thead>
          <tbody>
            {week.bars
              .filter((bar) => !bar.isFuture)
              .map((bar) => (
                <tr key={bar.date}>
                  <th scope="row">
                    {weekdayShortLabels[bar.weekday]} {formatDateForDisplay(bar.date).slice(0, 5)}
                    {bar.isToday ? " (hoje)" : ""}
                  </th>
                  <td>{hours(bar.minutes)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function CategoryBar({ categories }: { categories: CategoryShare[] }) {
  const titleId = useId();
  return (
    <figure aria-labelledby={titleId} className="space-y-3">
      <figcaption id={titleId} className="text-sm font-medium">
        Trabalho por categoria
      </figcaption>
      {/* gap-0.5: 2px of the card between the segments. */}
      <div aria-hidden="true" className="flex h-3 w-full gap-0.5 overflow-hidden rounded-sm">
        {categories.map((share) => (
          <div
            key={share.name}
            className={toneClass(share)}
            style={{ width: `${share.percent}%` }}
          />
        ))}
      </div>
      {/* The legend carries the data in text: name, percentage and hours. */}
      <ul
        className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2"
        aria-label="Trabalho por categoria"
      >
        {categories.map((share) => (
          <li key={share.name} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn("size-3 shrink-0 rounded-sm", toneClass(share))}
            />
            <span className="min-w-0 flex-1 truncate">{share.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {share.percent}% · {hours(share.minutes)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
