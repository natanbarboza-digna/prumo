import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  calendarDayName,
  dayStateLabels,
  monthSummaryText,
  monthTitle,
  weekdayShortLabels,
} from "@/modules/routines/labels";
import {
  type CalendarDay,
  type CalendarDayState,
  type MonthCalendar,
  type MonthRange,
  addMonths,
} from "@/modules/routines/rules";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

/** Color never stands alone: each state also has a symbol and a name. */
const stateStyle: Record<CalendarDayState, { className: string; symbol: string }> = {
  DONE: { className: "bg-success/15 text-success font-medium", symbol: "✓" },
  SKIPPED: { className: "bg-muted text-muted-foreground", symbol: "–" },
  MISSED: { className: "border border-destructive/60 text-destructive", symbol: "!" },
  PENDING: { className: "border-2 border-primary/50", symbol: "" },
  NOT_SCHEDULED: { className: "text-muted-foreground", symbol: "" },
  FUTURE: { className: "text-muted-foreground", symbol: "" },
  OUTSIDE: { className: "", symbol: "" },
};

const LEGEND: CalendarDayState[] = ["DONE", "SKIPPED", "MISSED", "PENDING"];

type RoutineCalendarProps = {
  routineId: string;
  calendar: MonthCalendar;
  range: MonthRange;
};

/**
 * A month of the routine (plan 016). A Server Component: it only shows data,
 * and the month links are plain links with the month in the URL (?mes=).
 */
export function RoutineCalendar({ routineId, calendar, range }: RoutineCalendarProps) {
  const { month, weeks, adherence } = calendar;
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  const href = (target: string) => `/routines/${routineId}?mes=${target}`;

  return (
    <section aria-labelledby="titulo-calendario" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-calendario" className="text-xl font-semibold tracking-tight">
          Calendário
        </h2>
        <nav aria-label="Mês do calendário" className="flex gap-3 text-sm">
          {previous >= range.from && (
            <Link href={href(previous)} className="underline-offset-4 hover:underline">
              ‹ Mês anterior
            </Link>
          )}
          {next <= range.to && (
            <Link href={href(next)} className="underline-offset-4 hover:underline">
              Próximo mês ›
            </Link>
          )}
        </nav>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1">
        <caption className="pb-2 text-left font-medium">{monthTitle(month)}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((day) => (
              <th key={day} scope="col" className="text-muted-foreground pb-1 text-xs font-normal">
                {weekdayShortLabels[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]?.date}>
              {week.map((day) => (
                <td key={day.date} className="p-0">
                  <DayCell day={day} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul
        className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
        aria-label="Legenda"
      >
        {LEGEND.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex size-4 items-center justify-center rounded text-xs",
                stateStyle[state].className,
              )}
            >
              {stateStyle[state].symbol}
            </span>
            <span className="first-letter:uppercase">{dayStateLabels[state]}</span>
          </li>
        ))}
      </ul>

      <p className="text-sm">{monthSummaryText(month, adherence)}</p>
    </section>
  );
}

function DayCell({ day }: { day: CalendarDay }) {
  if (day.state === "OUTSIDE") return null;
  const { className, symbol } = stateStyle[day.state];
  const dayNumber = Number(day.date.slice(8));
  return (
    <div
      className={cn(
        "flex h-10 flex-col items-center justify-center rounded-md text-xs leading-tight sm:h-12 sm:text-sm",
        className,
        day.isToday && "ring-ring ring-2",
      )}
    >
      {/* The visible number and symbol are for the eye; the full name is for screen readers. */}
      <span aria-hidden="true">{dayNumber}</span>
      {symbol && <span aria-hidden="true">{symbol}</span>}
      <span className="sr-only">
        {calendarDayName(day.date, day.state)}
        {day.isToday ? " (hoje)" : ""}
      </span>
    </div>
  );
}
