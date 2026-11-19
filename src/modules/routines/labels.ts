import type { RoutineLogStatus, Weekday } from "@/generated/prisma/enums";
import { formatLongDate } from "@/lib/dates";
import type { Adherence, CalendarDayState } from "@/modules/routines/rules";

export const weekdayShortLabels: Record<Weekday, string> = {
  MON: "Seg",
  TUE: "Ter",
  WED: "Qua",
  THU: "Qui",
  FRI: "Sex",
  SAT: "Sáb",
  SUN: "Dom",
};

export const weekdayLongLabels: Record<Weekday, string> = {
  MON: "Segunda-feira",
  TUE: "Terça-feira",
  WED: "Quarta-feira",
  THU: "Quinta-feira",
  FRI: "Sexta-feira",
  SAT: "Sábado",
  SUN: "Domingo",
};

export const logStatusLabels: Record<RoutineLogStatus, string> = {
  DONE: "Feita",
  SKIPPED: "Pulada",
};

/** "Seg, Qua, Sex · 07:00". Weekdays come from the service already in week order. */
export function scheduleText(weekdays: readonly Weekday[], timeOfDay: string | null): string {
  const days =
    weekdays.length === 7
      ? "Todos os dias"
      : weekdays.map((day) => weekdayShortLabels[day]).join(", ");
  return timeOfDay ? `${days} · ${timeOfDay}` : days;
}

/** "18 de 20 dias feitos". */
export function adherenceText({ scheduled, done }: Pick<Adherence, "scheduled" | "done">): string {
  if (scheduled === 0) return "Nenhum dia para contar ainda";
  return `${done} de ${scheduled} ${scheduled === 1 ? "dia feito" : "dias feitos"}`;
}

/** "2 de 4 feitas", for the "Today" screen. */
export function doneTodayText(done: number, total: number): string {
  return `${done} de ${total} ${total === 1 ? "feita" : "feitas"}`;
}

// ---------------------------------------------------------------------------
// Monthly calendar (plan 016)
// ---------------------------------------------------------------------------

export const dayStateLabels: Record<CalendarDayState, string> = {
  DONE: "feita",
  SKIPPED: "pulada",
  MISSED: "sem registro",
  PENDING: "pendente",
  NOT_SCHEDULED: "não prevista",
  FUTURE: "ainda não chegou",
  OUTSIDE: "fora do mês",
};

const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthNameFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

const firstOfMonth = (month: string) => new Date(`${month}-01T00:00:00Z`);

/** "2026-11" → "Novembro de 2026". */
export function monthTitle(month: string): string {
  const text = monthFormat.format(firstOfMonth(month));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "segunda-feira, 2 de novembro: feita", for screen readers. */
export function calendarDayName(date: string, state: CalendarDayState): string {
  return `${formatLongDate(date)}: ${dayStateLabels[state]}`;
}

const count = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

/** "Em outubro: 18 feitas, 2 puladas e 3 sem registro, 78% de adesão." */
export function monthSummaryText(month: string, adherence: Adherence): string {
  const name = monthNameFormat.format(firstOfMonth(month));
  if (adherence.scheduled === 0) return `Em ${name}: nenhum dia para contar ainda.`;
  return (
    `Em ${name}: ${count(adherence.done, "feita", "feitas")}, ` +
    `${count(adherence.skipped, "pulada", "puladas")} e ${adherence.missed} sem registro, ` +
    `${adherence.rate}% de adesão.`
  );
}
