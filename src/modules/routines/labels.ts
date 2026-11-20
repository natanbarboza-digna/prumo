import type { RoutineLogStatus, Weekday } from "@/generated/prisma/enums";
import { formatLongDate } from "@/lib/dates";
import type { Adherence, CalendarDayState, RoutineStreak } from "@/modules/routines/rules";

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

/**
 * "Seg, Qua, Sex · 07:00" or "3 vezes por semana · 18:30". Weekdays come from
 * the service already in week order.
 */
export function scheduleText(routine: {
  weekdays: readonly Weekday[];
  timesPerWeek?: number | null;
  timeOfDay: string | null;
}): string {
  const { weekdays, timesPerWeek, timeOfDay } = routine;
  const days = timesPerWeek
    ? `${timesPerWeek} ${timesPerWeek === 1 ? "vez" : "vezes"} por semana`
    : weekdays.length === 7
      ? "Todos os dias"
      : weekdays.map((day) => weekdayShortLabels[day]).join(", ");
  return timeOfDay ? `${days} · ${timeOfDay}` : days;
}

/** "1 de 3 nesta semana", or "Meta da semana cumprida (3 de 3)" once reached. */
export function weekProgressText({ done, target }: { done: number; target: number }): string {
  return done >= target
    ? `Meta da semana cumprida (${done} de ${target})`
    : `${done} de ${target} nesta semana`;
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
  OPEN: "livre",
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

/**
 * "Em outubro: 18 feitas, 2 puladas e 3 sem registro, 78% de adesão." For a
 * weekly goal, in goal days: "Em novembro: 10 de 12 dias da meta, 83% de adesão."
 */
export function monthSummaryText(
  month: string,
  adherence: Adherence,
  options: { weeklyGoal?: boolean } = {},
): string {
  const name = monthNameFormat.format(firstOfMonth(month));
  if (adherence.scheduled === 0) return `Em ${name}: nenhum dia para contar ainda.`;
  if (options.weeklyGoal) {
    return `Em ${name}: ${adherence.done} de ${adherence.scheduled} dias da meta, ${adherence.rate}% de adesão.`;
  }
  return (
    `Em ${name}: ${count(adherence.done, "feita", "feitas")}, ` +
    `${count(adherence.skipped, "pulada", "puladas")} e ${adherence.missed} sem registro, ` +
    `${adherence.rate}% de adesão.`
  );
}

/** For screen readers, in the calendar's "Meta" column (plan 017). */
export function weekGoalName(goal: { done: number; target: number; current: boolean }): string {
  if (goal.done >= goal.target) return `meta da semana cumprida, ${goal.done} de ${goal.target}`;
  if (goal.current) return `semana em andamento, ${goal.done} de ${goal.target}`;
  return `meta da semana não cumprida, ${goal.done} de ${goal.target}`;
}

// ---------------------------------------------------------------------------
// Streak (plan 019)
// ---------------------------------------------------------------------------

function streakAmount(n: number, unit: RoutineStreak["unit"]): string {
  if (unit === "WEEKS") return `${n} ${n === 1 ? "semana" : "semanas"}`;
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

/** "5 dias seguidos" for Hoje, the dashboard and the list; null below 2 (it says little). */
export function streakShortText(streak: RoutineStreak): string | null {
  if (streak.current === null || streak.current < 2) return null;
  return streak.unit === "WEEKS"
    ? `${streak.current} semanas seguidas`
    : `${streak.current} dias seguidos`;
}

/** "Sequência atual: 5 dias · Recorde: 12 dias", on the routine page. */
export function streakPageText(streak: RoutineStreak): string {
  if (streak.best === 0) return "Nenhuma sequência ainda";
  const best = `Recorde: ${streakAmount(streak.best, streak.unit)}`;
  if (streak.current === null) return best;
  return `Sequência atual: ${streakAmount(streak.current, streak.unit)} · ${best}`;
}

/** Confirmation when unlinking a routine from its PDI action (plan 020). */
export function unlinkRoutineText(routineTitle: string, actionTitle: string): string {
  return `Os registros de “${routineTitle}” deixam de contar como evidência da ação “${actionTitle}”. A rotina e os registros continuam.`;
}

/** One week of the adherence chart (plan 029), as read in its table. */
export function weekAdherenceText(adherence: Adherence | null): string {
  if (adherence === null) return "sem dias previstos";
  if (adherence.scheduled === 0) return "nada para contar ainda";
  const days = adherence.scheduled === 1 ? "dia" : "dias";
  return `${adherence.rate}% (${adherence.done} de ${adherence.scheduled} ${days})`;
}
