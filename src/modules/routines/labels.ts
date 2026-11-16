import type { RoutineLogStatus, Weekday } from "@/generated/prisma/enums";
import type { Adherence } from "@/modules/routines/service";

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
