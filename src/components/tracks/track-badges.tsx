import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import type { TrackStepStatus } from "@/generated/prisma/enums";
import { trackStatusLabels, trackStepStatusLabels } from "@/modules/tracks/labels";
import type { TrackStatus } from "@/modules/tracks/service";

type Variant = ComponentProps<typeof Badge>["variant"];

const variants: Record<TrackStatus, Variant> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "secondary",
  DONE: "default",
};

export function TrackStatusBadge({ status }: { status: TrackStatus }) {
  return <Badge variant={variants[status]}>{trackStatusLabels[status]}</Badge>;
}

export function StepStatusBadge({ status }: { status: TrackStepStatus }) {
  return <Badge variant={variants[status]}>{trackStepStatusLabels[status]}</Badge>;
}

export function StepOverdueBadge() {
  return <Badge variant="destructive">Atrasada</Badge>;
}
