import Link from "next/link";

import { GoalStatusBadge, OverdueBadge } from "@/components/goals/goal-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateForDisplay } from "@/lib/dates";
import { type Goal, isGoalOverdue } from "@/modules/goals/service";

type GoalListProps = {
  goals: Goal[];
  today: string;
  filtered: boolean;
};

export function GoalList({ goals, today, filtered }: GoalListProps) {
  if (goals.length === 0) {
    return filtered ? (
      <p className="text-muted-foreground">Nenhum objetivo com este status.</p>
    ) : (
      <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">Você ainda não tem objetivos cadastrados.</p>
        <Button asChild>
          <Link href="/goals/new">Criar objetivo</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid gap-3" aria-label="Objetivos">
      {goals.map((goal) => (
        <li key={goal.id}>
          <Card className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">
                <Link href={`/goals/${goal.id}`} className="hover:underline">
                  {goal.title}
                </Link>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <GoalStatusBadge status={goal.status} />
                {isGoalOverdue(goal, today) && <OverdueBadge />}
                <span>
                  {goal.targetDate
                    ? `Data-alvo: ${formatDateForDisplay(goal.targetDate)}`
                    : "Sem data-alvo"}
                </span>
              </CardDescription>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
