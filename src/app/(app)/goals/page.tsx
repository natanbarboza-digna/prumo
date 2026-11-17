import type { Metadata } from "next";
import Link from "next/link";

import { GoalFilter } from "@/components/goals/goal-filter";
import { GoalList } from "@/components/goals/goal-list";
import { Button } from "@/components/ui/button";
import { todayInAppTimeZone } from "@/lib/dates";
import { goalStatusFilterSchema } from "@/modules/goals/schemas";
import { listGoals } from "@/modules/goals/service";

export const metadata: Metadata = { title: "Objetivos" };

// Server Component: it reads the database directly on the server. While it
// waits, the segment's loading.tsx is shown.
export default async function GoalsPage({ searchParams }: PageProps<"/goals">) {
  const status = goalStatusFilterSchema.parse((await searchParams).status);
  const goals = await listGoals({ status });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Objetivos</h1>
        <Button asChild>
          <Link href="/goals/new">Novo objetivo</Link>
        </Button>
      </div>
      <GoalFilter current={status} />
      <GoalList goals={goals} today={todayInAppTimeZone()} filtered={status !== undefined} />
    </div>
  );
}
