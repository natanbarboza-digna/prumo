import Link from "next/link";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { cn } from "@/lib/utils";
import { goalCountText, goalPaceText } from "@/modules/books/labels";
import type { DashboardReading } from "@/modules/dashboard/service";

/** "Leitura do ano" (plan 037): the year's goal and the books being read. */
export function ReadingCard({ reading, year }: { reading: DashboardReading; year: number }) {
  const { goal, books } = reading;
  const percent = goal === null ? 0 : Math.min(100, Math.round((goal.read / goal.target) * 100));

  return (
    <DashboardCard
      id="leitura"
      title="Leitura do ano"
      more={{ href: "/books/analytics", label: "Ver analíticos" }}
    >
      {goal === null ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma meta para {year}.{" "}
          <Link href="/books/analytics" className="text-foreground underline underline-offset-4">
            Definir meta de leitura
          </Link>
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <ProgressRing percent={percent} label={`${goalCountText(goal)} da meta de ${year}`} />
          <div className="space-y-1 text-sm">
            <p className="font-medium">{goalCountText(goal)}</p>
            <p className={cn(goal.ahead !== null && goal.ahead < 0 && "text-destructive")}>
              {goalPaceText(goal)}
            </p>
          </div>
        </div>
      )}
      {books.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Lendo agora</h3>
          <ul className="grid gap-1.5 text-sm" aria-label="Lendo agora">
            {books.map((book) => (
              <li key={book.id} className="flex items-baseline justify-between gap-2">
                <Link href={`/books/${book.id}`} className="min-w-0 break-words hover:underline">
                  {book.title}
                </Link>
                {book.percent !== null && (
                  <span className="text-muted-foreground tabular-nums">{book.percent}%</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}
