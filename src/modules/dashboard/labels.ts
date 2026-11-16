import { daysBetween, formatDateForDisplay } from "@/lib/dates";
import type { DeadlineKind } from "@/modules/dashboard/rules";
import { ADHERENCE_DAYS, type Adherence } from "@/modules/routines/rules";

export const deadlineKindLabels: Record<DeadlineKind, string> = {
  STEP: "Etapa",
  ACTION: "Ação de PDI",
  GOAL: "Objetivo",
};

/** "Vence hoje", "Vence em 20/11/2026" or "Venceu em 10/11/2026". */
export function dueText(date: string, today: string): string {
  if (date === today) return "Vence hoje";
  const display = formatDateForDisplay(date);
  return date < today ? `Venceu em ${display}` : `Vence em ${display}`;
}

/** "Faltam 14 dias", "Termina hoje" or "Terminou há 3 dias", for the active cycle. */
export function cycleTimeText(endDate: string, today: string): string {
  const days = daysBetween(today, endDate);
  if (days === 0) return "Termina hoje";
  if (days > 0) return days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`;
  return `Terminou há ${-days} ${days === -1 ? "dia" : "dias"}`;
}

/** "hoje", "ontem" or "há 14 dias". */
export function daysAgoText(date: string, today: string): string {
  const days = daysBetween(date, today);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

/** "Adesão em 30 dias: 80%", summing the active routines. */
export function recentAdherenceText(adherence: Adherence): string {
  const subject = `Adesão em ${ADHERENCE_DAYS} dias`;
  if (adherence.scheduled === 0) return `${subject}: nenhum dia para contar ainda`;
  return `${subject}: ${adherence.rate}%`;
}
