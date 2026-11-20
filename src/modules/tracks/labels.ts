import { TrackStepStatus } from "@/generated/prisma/enums";
import type { TrackFilter } from "@/modules/tracks/schemas";
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

/** The track list's filter links (plan 024), in screen order. */
export const trackFilterLabels: Record<TrackFilter, string> = {
  ACTIVE: "Ativas",
  NOT_STARTED: "Não iniciadas",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluídas",
  ARCHIVED: "Arquivadas",
  ALL: "Todas",
};

/** What an empty filtered list says (the default list invites to create a track instead). */
export const trackFilterEmptyText: Record<Exclude<TrackFilter, "ACTIVE">, string> = {
  NOT_STARTED: "Nenhuma trilha não iniciada.",
  IN_PROGRESS: "Nenhuma trilha em andamento.",
  DONE: "Nenhuma trilha concluída.",
  ARCHIVED: "Nenhuma trilha arquivada.",
  ALL: "Você ainda não tem trilhas cadastradas.",
};

/** "1 de 3 etapas concluídas", with the singular when there is a single step. */
export function stepProgressText(done: number, total: number): string {
  if (total === 0) return "Nenhuma etapa ainda";
  return `${done} de ${total} ${total === 1 ? "etapa concluída" : "etapas concluídas"}`;
}
