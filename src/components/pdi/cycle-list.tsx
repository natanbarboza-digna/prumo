import Link from "next/link";

import { ActionProgressBar } from "@/components/pdi/action-progress";
import { CycleStatusBadge } from "@/components/pdi/pdi-badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateForDisplay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PdiCycleSummary } from "@/modules/pdi/service";

export function CycleList({ cycles }: { cycles: PdiCycleSummary[] }) {
  return (
    <ul className="grid gap-3" aria-label="Ciclos de PDI">
      {cycles.map((cycle) => (
        <li key={cycle.id}>
          <Card className={cn("gap-3 py-4", cycle.status === "ACTIVE" && "border-primary")}>
            <CardHeader className="px-4">
              <CardTitle className="text-base">
                <h2 className="text-base">
                  <Link href={`/pdi/${cycle.id}`} className="hover:underline">
                    {cycle.title}
                  </Link>
                </h2>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <CycleStatusBadge status={cycle.status} />
                <span>
                  {formatDateForDisplay(cycle.startDate)} a {formatDateForDisplay(cycle.endDate)}
                </span>
                {cycle.managerName && <span>Gestor: {cycle.managerName}</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <ActionProgressBar
                done={cycle.progress.done}
                total={cycle.progress.total}
                label={`Progresso do ciclo ${cycle.title}`}
              />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
