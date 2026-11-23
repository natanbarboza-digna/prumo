import { addDays, daysBetween, formatDateForDisplay, mondayOf } from "@/lib/dates";
import type { DashboardKpis, DeadlineKind } from "@/modules/dashboard/rules";
import type { DeadlineKindFilter, DeadlinePeriod } from "@/modules/dashboard/schemas";
import { ADHERENCE_DAYS, type Adherence } from "@/modules/routines/rules";
import { durationText } from "@/modules/time/labels";

export const deadlineKindLabels: Record<DeadlineKind, string> = {
  STEP: "Etapa",
  ACTION: "Ação de PDI",
  GOAL: "Objetivo",
  BOOK: "Livro",
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

// ---------------------------------------------------------------------------
// Deadlines page (plan 028)
// ---------------------------------------------------------------------------

export const deadlinePeriodLabels: Record<DeadlinePeriod, string> = {
  "7": "Próximos 7 dias",
  "30": "Próximos 30 dias",
  "90": "Próximos 90 dias",
  all: "Todos",
};

export const deadlineKindFilterLabels: Record<DeadlineKindFilter, string> = {
  ALL: "Todos",
  STEP: "Etapas",
  ACTION: "Ações de PDI",
  GOAL: "Objetivos",
  BOOK: "Livros",
};

/** "Esta semana", "Próxima semana" or "Semana de 30/11 a 06/12". */
export function weekTitle(monday: string, sunday: string, today: string): string {
  const thisMonday = mondayOf(today);
  if (monday === thisMonday) return "Esta semana";
  if (monday === addDays(thisMonday, 7)) return "Próxima semana";
  const short = (date: string) => formatDateForDisplay(date).slice(0, 5);
  return `Semana de ${short(monday)} a ${short(sunday)}`;
}

/** The empty deadlines page, for the chosen period. */
export function deadlinesEmptyText(period: DeadlinePeriod): string {
  if (period === "all") return "Nenhum prazo em aberto.";
  return `Nenhum prazo atrasado nem nos próximos ${period} dias.`;
}

// ---------------------------------------------------------------------------
// Dashboard numbers (plan 034)
// ---------------------------------------------------------------------------

/** `alert`: shown in red (overdue items only). */
export type KpiItem = { label: string; value: string; href: string; alert: boolean };

const NOTHING = "—";

export function kpiItems(kpis: DashboardKpis): KpiItem[] {
  const { routinesToday, adherence, workedThisWeek, overdue, pdi } = kpis;
  return [
    {
      label: "Rotinas hoje",
      value:
        routinesToday.total === 0 ? NOTHING : `${routinesToday.done} de ${routinesToday.total}`,
      href: "/today",
      alert: false,
    },
    {
      label: `Adesão em ${ADHERENCE_DAYS} dias`,
      value: adherence.scheduled === 0 ? NOTHING : `${adherence.rate}%`,
      href: "/routines",
      alert: false,
    },
    {
      label: "Trabalhado na semana",
      value: workedThisWeek === 0 ? "0h" : durationText(workedThisWeek),
      href: "/time/analytics",
      alert: false,
    },
    { label: "Prazos atrasados", value: String(overdue), href: "/deadlines", alert: overdue > 0 },
    {
      label: "PDI concluído",
      value: pdi === null ? NOTHING : `${pdi.percent}%`,
      href: pdi === null ? "/pdi" : `/pdi/${pdi.cycleId}`,
      alert: false,
    },
  ];
}
