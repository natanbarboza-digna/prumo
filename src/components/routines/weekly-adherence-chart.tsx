import { useId } from "react";

import { formatDateForDisplay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { weekAdherenceText } from "@/modules/routines/labels";
import type { WeekAdherence } from "@/modules/routines/rules";

type WeeklyAdherenceChartProps = {
  weeks: WeekAdherence[];
  title: string;
  /** The dashboard's version: lower bars, no labels around them. */
  compact?: boolean;
};

const dayMonth = (date: string) => formatDateForDisplay(date).slice(0, 5);

/**
 * Bars of the last weeks' adherence (plan 029), in plain CSS: no chart library.
 * The bars are decorative (aria-hidden); screen readers get the same numbers
 * from a table that is only hidden visually. A Server Component.
 */
export function WeeklyAdherenceChart({ weeks, title, compact = false }: WeeklyAdherenceChartProps) {
  const titleId = useId();

  return (
    <figure aria-labelledby={titleId} className="space-y-2">
      <figcaption id={titleId} className="text-sm font-medium">
        {title}
      </figcaption>

      <div aria-hidden="true" className="flex items-end gap-1">
        {weeks.map((week, index) => {
          const adherence = week.adherence;
          const hasBar = adherence !== null && adherence.scheduled > 0;
          return (
            <div key={week.monday} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              {!compact && (
                <span className="text-muted-foreground hidden text-xs sm:block">
                  {hasBar ? `${adherence.rate}%` : "–"}
                </span>
              )}
              <div
                className={cn(
                  "bg-muted flex w-full items-end overflow-hidden rounded-sm",
                  compact ? "h-10" : "h-24",
                  week.current && "ring-ring ring-1",
                )}
              >
                {hasBar && (
                  // The height is the data itself, so it goes inline instead of a class.
                  <div className="bg-primary w-full" style={{ height: `${adherence.rate}%` }} />
                )}
              </div>
              {!compact && (
                <span
                  className={cn(
                    "text-muted-foreground text-xs whitespace-nowrap",
                    // On phones only one date in three fits, from the oldest week
                    // (so the last column, at the right edge, has none to spill
                    // over). "invisible" keeps the space: every column stays the
                    // same height and the bars line up.
                    index % 3 !== 0 && "invisible sm:visible",
                  )}
                >
                  {dayMonth(week.monday)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* sr-only on a wrapper: a <table> ignores the width and overflow that
          sr-only relies on, and would widen the page on small screens. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Semana</th>
              <th scope="col">Adesão</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.monday}>
                <th scope="row">
                  {dayMonth(week.monday)} a {dayMonth(week.sunday)}
                  {week.current && " (esta semana)"}
                </th>
                <td>{weekAdherenceText(week.adherence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
