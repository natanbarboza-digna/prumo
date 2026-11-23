import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { formatDateForDisplay } from "@/lib/dates";
import { deleteBookLogAction } from "@/modules/books/actions";
import { amountText, positionText } from "@/modules/books/labels";
import { type ProgressUnit, type ReadingLog, logAmounts } from "@/modules/books/rules";

/** The current reading's logs, newest first, each with what the day added (plan 036). */
export function ReadingLogList({ logs, unit }: { logs: ReadingLog[]; unit: ProgressUnit }) {
  if (logs.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma leitura registrada ainda.</p>;
  }
  const items = logAmounts(logs).reverse();
  return (
    <ul className="divide-y rounded-lg border" aria-label="Registros de leitura">
      {items.map((log) => {
        const date = formatDateForDisplay(log.date);
        return (
          <li
            key={log.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm"
          >
            <span className="w-24 tabular-nums">{date}</span>
            <span className="font-medium">{positionText(unit, log.position)}</span>
            <span className="text-muted-foreground">{amountText(unit, log.amount)}</span>
            <span className="ml-auto">
              <ConfirmDeleteButton
                action={deleteBookLogAction.bind(null, log.id)}
                title="Excluir registro?"
                description={`O registro de ${date} será excluído.`}
                triggerLabel={`Excluir registro de ${date}`}
                size="sm"
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
