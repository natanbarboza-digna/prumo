import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import type { GoalStatus } from "@/generated/prisma/enums";
import { goalStatusLabels } from "@/modules/goals/labels";

const variants: Record<GoalStatus, ComponentProps<typeof Badge>["variant"]> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "secondary",
  DONE: "success",
  ARCHIVED: "outline",
};

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  return <Badge variant={variants[status]}>{goalStatusLabels[status]}</Badge>;
}

export function OverdueBadge() {
  return <Badge variant="destructive">Atrasado</Badge>;
}
