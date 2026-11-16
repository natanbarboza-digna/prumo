import type { PdiActionStatus, PdiCycleStatus } from "@/generated/prisma/enums";

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
