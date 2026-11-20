import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DeadlineItem } from "@/components/deadlines/deadline-item";
import { DEADLINE_HORIZON_DAYS, type DeadlineGroup } from "@/modules/dashboard/rules";
import type { Dashboard } from "@/modules/dashboard/service";

const upcomingTitle = `Próximos ${DEADLINE_HORIZON_DAYS} dias`;

/** Overdue steps, actions and goals, and what is due in the next days. */
export function DeadlinesCard({
  deadlines,
  today,
}: {
  deadlines: Dashboard["deadlines"];
  today: string;
}) {
  const { overdue, upcoming } = deadlines;
  return (
    <DashboardCard
      id="prazos"
      title="Prazos"
      more={{ href: "/deadlines", label: "Ver todos os prazos" }}
    >
      {overdue.items.length === 0 && upcoming.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhum prazo atrasado nem nos próximos {DEADLINE_HORIZON_DAYS} dias.
        </p>
      ) : (
        <>
          <Group title="Atrasados" group={overdue} today={today} />
          <Group title={upcomingTitle} group={upcoming} today={today} />
        </>
      )}
    </DashboardCard>
  );
}

function Group({ title, group, today }: { title: string; group: DeadlineGroup; today: string }) {
  if (group.items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="grid gap-2" aria-label={title}>
        {group.items.map((item) => (
          <DeadlineItem key={`${item.kind}-${item.id}`} item={item} today={today} />
        ))}
      </ul>
      {group.hidden > 0 && <p className="text-muted-foreground text-sm">e mais {group.hidden}</p>}
    </div>
  );
}
