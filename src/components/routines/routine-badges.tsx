import { Badge } from "@/components/ui/badge";
import { formatDateForDisplay } from "@/lib/dates";
import { routineStateOn } from "@/modules/routines/rules";
import type { Routine } from "@/modules/routines/service";

/** "Começa em 01/12", "Termina hoje" or "Encerrada"; nothing for a plain active routine. */
export function RoutineStateBadge({
  routine,
  today,
}: {
  routine: Pick<Routine, "startDate" | "endDate">;
  today: string;
}) {
  const state = routineStateOn(routine, today);
  if (state === "UPCOMING") {
    const dayAndMonth = formatDateForDisplay(routine.startDate).slice(0, 5);
    return <Badge variant="outline">Começa em {dayAndMonth}</Badge>;
  }
  if (state === "ENDED") return <Badge variant="secondary">Encerrada</Badge>;
  if (routine.endDate === today) return <Badge variant="outline">Termina hoje</Badge>;
  return null;
}
