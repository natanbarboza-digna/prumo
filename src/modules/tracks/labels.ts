import { TrackStepStatus } from "@/generated/prisma/enums";
import type { TrackStatus } from "@/modules/tracks/service";

export const trackStepStatusLabels: Record<TrackStepStatus, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
};

export const trackStepStatusOrder: readonly TrackStepStatus[] = Object.values(TrackStepStatus);

export const trackStatusLabels: Record<TrackStatus, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
};

/** "1 de 3 etapas concluídas", with the singular when there is a single step. */
export function stepProgressText(done: number, total: number): string {
  if (total === 0) return "Nenhuma etapa ainda";
  return `${done} de ${total} ${total === 1 ? "etapa concluída" : "etapas concluídas"}`;
}
