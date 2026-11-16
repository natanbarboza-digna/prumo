import { GoalStatus } from "@/generated/prisma/enums";

export const goalStatusLabels: Record<GoalStatus, string> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
  ARCHIVED: "Arquivado",
};

/** Statuses in the order they appear in selects and filters. */
export const goalStatusOrder: readonly GoalStatus[] = Object.values(GoalStatus);
