import type { Metadata } from "next";
import Link from "next/link";

import { PdiLinkNotice } from "@/components/routines/pdi-link-notice";
import { RoutineForm } from "@/components/routines/routine-form";
import { Button } from "@/components/ui/button";
import { todayInAppTimeZone } from "@/lib/dates";
import { goalOptions } from "@/modules/goals/options";
import { routineBlockerText } from "@/modules/pdi/labels";
import {
  type PdiAction,
  PdiActionNotFoundError,
  getAction,
  getCycle,
  routineBlocker,
} from "@/modules/pdi/service";
import { createRoutineAction } from "@/modules/routines/actions";

export const metadata: Metadata = { title: "Nova rotina" };

const heading = <h1 className="text-2xl font-semibold tracking-tight">Nova rotina</h1>;

/** The action behind ?pdiActionId=, or null when the id points nowhere. */
async function findSourceAction(id: string): Promise<PdiAction | null> {
  try {
    return await getAction(id);
  } catch (error) {
    if (error instanceof PdiActionNotFoundError) return null;
    throw error;
  }
}

export default async function NewRoutinePage({ searchParams }: PageProps<"/routines/new">) {
  // "Criar rotina" on a goal page links here with ?goalId= to preselect it,
  // and on a PDI action with ?pdiActionId= to link the routine to it.
  const { goalId, pdiActionId } = await searchParams;
  const goals = await goalOptions();
  // After the first database read, so Next already renders this page per request.
  const today = todayInAppTimeZone();

  if (typeof pdiActionId === "string" && pdiActionId) {
    const action = await findSourceAction(pdiActionId);
    if (action === null) {
      return (
        <div className="max-w-2xl space-y-4">
          {heading}
          <p>Esta ação de PDI não existe mais.</p>
          <Button asChild variant="outline">
            <Link href="/pdi">Ver ciclos</Link>
          </Button>
        </div>
      );
    }

    const cycle = await getCycle(action.cycleId);
    const actionHref = `/pdi/${cycle.id}/actions/${action.id}`;
    const blocker = routineBlocker(action, cycle.status);
    if (blocker !== null) {
      return (
        <div className="max-w-2xl space-y-4">
          {heading}
          <p>Não é possível criar uma rotina para “{action.title}”.</p>
          <p className="text-muted-foreground">{routineBlockerText[blocker]}</p>
          <Button asChild variant="outline">
            <Link href={actionHref}>Voltar para a ação</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="max-w-2xl space-y-6">
        {heading}
        <PdiLinkNotice action={action} cycleTitle={cycle.title} />
        <RoutineForm
          action={createRoutineAction}
          goals={goals}
          pdiActionId={action.id}
          defaultValues={{
            title: action.title,
            weekdays: [],
            startDate: today,
            // The action's due date is a natural end, while it is still ahead.
            endDate: action.dueDate !== null && action.dueDate >= today ? action.dueDate : "",
            goalId: goals.find((goal) => goal.id === action.goal?.id)?.id ?? "",
          }}
          submitLabel="Criar rotina"
          cancelHref={actionHref}
        />
      </div>
    );
  }

  const preselected = goals.find((goal) => goal.id === goalId)?.id ?? "";

  return (
    <div className="max-w-2xl space-y-6">
      {heading}
      <RoutineForm
        action={createRoutineAction}
        goals={goals}
        defaultValues={{ title: "", weekdays: [], startDate: today, goalId: preselected }}
        submitLabel="Criar rotina"
        cancelHref="/routines"
      />
    </div>
  );
}
