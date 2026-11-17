import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import type { PdiActionStatus, PdiCycleStatus } from "@/generated/prisma/enums";
import { actionStatusLabels, cycleStatusLabels } from "@/modules/pdi/labels";

type Variant = ComponentProps<typeof Badge>["variant"];

const cycleVariants: Record<PdiCycleStatus, Variant> = {
  PLANNED: "outline",
  ACTIVE: "default",
  CLOSED: "secondary",
};

const actionVariants: Record<PdiActionStatus, Variant> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "secondary",
  DONE: "success",
  CANCELLED: "outline",
};

export function CycleStatusBadge({ status }: { status: PdiCycleStatus }) {
  return <Badge variant={cycleVariants[status]}>{cycleStatusLabels[status]}</Badge>;
}

export function ActionStatusBadge({ status }: { status: PdiActionStatus }) {
  return (
    <Badge
      variant={actionVariants[status]}
      className={status === "CANCELLED" ? "line-through" : undefined}
    >
      {actionStatusLabels[status]}
    </Badge>
  );
}

export function ActionOverdueBadge() {
  return <Badge variant="destructive">Atrasada</Badge>;
}
