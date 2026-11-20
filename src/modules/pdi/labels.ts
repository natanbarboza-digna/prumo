import type { PdiActionStatus, PdiCycleStatus } from "@/generated/prisma/enums";
import type { Adherence } from "@/modules/routines/rules";

export const cycleStatusLabels: Record<PdiCycleStatus, string> = {
  PLANNED: "Planejado",
  ACTIVE: "Ativo",
  CLOSED: "Encerrado",
};

export const actionStatusLabels: Record<PdiActionStatus, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export const actionStatusOrder: readonly PdiActionStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];

/** "1 de 3 ações concluídas" (cancelled actions are already out of the count). */
export function actionProgressText(done: number, total: number): string {
  if (total === 0) return "Nenhuma ação ainda";
  return `${done} de ${total} ${total === 1 ? "ação concluída" : "ações concluídas"}`;
}

/** "3 de 5 itens concluídos", for a goal's steps and PDI actions together. */
export function itemProgressText(done: number, total: number): string {
  if (total === 0) return "Nenhum item vinculado ainda";
  return `${done} de ${total} ${total === 1 ? "item concluído" : "itens concluídos"}`;
}

/** "Serão criados 1 ciclo, 3 áreas, 8 ações e 2 check-ins.", on the import preview (plan 022). */
export function importSummaryText(counts: { areas: number; actions: number; checkIns: number }) {
  const count = (n: number, one: string, many: string, none: string) =>
    n === 0 ? none : `${n} ${n === 1 ? one : many}`;
  const areas = count(counts.areas, "área", "áreas", "nenhuma área");
  const actions = count(counts.actions, "ação", "ações", "nenhuma ação");
  const checkIns = count(counts.checkIns, "check-in", "check-ins", "nenhum check-in");
  return `Serão criados 1 ciclo, ${areas}, ${actions} e ${checkIns}.`;
}

/** Why an action cannot get a new routine (see routineBlocker in the service). */
export const routineBlockerText: Record<"CYCLE_CLOSED" | "ACTION_FINISHED" | "CATEGORY", string> = {
  CYCLE_CLOSED: "O ciclo desta ação está encerrado.",
  ACTION_FINISHED: "Esta ação já foi concluída ou cancelada.",
  CATEGORY: "A categoria desta ação não permite criar rotina.",
};

/** "Rotina: 80% de adesão" or "2 rotinas: 75% de adesão", on the cycle page. */
export function routineEvidenceText({
  count,
  adherence,
}: {
  count: number;
  adherence: Adherence;
}): string {
  const subject = count === 1 ? "Rotina" : `${count} rotinas`;
  if (adherence.scheduled === 0) return `${subject}: nenhum dia para contar ainda`;
  return `${subject}: ${adherence.rate}% de adesão`;
}
