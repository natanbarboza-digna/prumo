import { Progress } from "@/components/ui/progress";
import { formatDateForDisplay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { paceText, progressText } from "@/modules/books/labels";
import type { BookProgress } from "@/modules/books/rules";

type ReadingProgressProps = {
  progress: BookProgress;
  title: string;
  /** Pace and forecast only while reading; null when they cannot be told. */
  pace: number | null;
  forecast: string | null;
  dueDate: string | null;
};

const missingTotal = {
  PAGE: "Preencha o número de páginas no livro para ver a porcentagem e a previsão.",
  MINUTE: "Preencha a duração do audiolivro para ver a porcentagem e a previsão.",
  PERCENT: null,
} as const;

/** Where the reading is (plan 036): bar, text, pace and when it should end. */
export function ReadingProgress({
  progress,
  title,
  pace,
  forecast,
  dueDate,
}: ReadingProgressProps) {
  const text = progressText(progress);
  // "YYYY-MM-DD" strings compare in calendar order.
  const late = forecast !== null && dueDate !== null && forecast > dueDate;
  return (
    <div className="space-y-2">
      {progress.percent !== null && (
        <Progress
          value={progress.percent}
          aria-label={`Progresso da leitura de ${title}`}
          aria-valuetext={text}
        />
      )}
      <p className="text-sm font-medium">{text}</p>
      {progress.total === null && missingTotal[progress.unit] && (
        <p className="text-muted-foreground text-sm">{missingTotal[progress.unit]}</p>
      )}
      {pace !== null && pace > 0 && (
        <p className="text-muted-foreground text-sm">{paceText(progress.unit, pace)}</p>
      )}
      {forecast && (
        <p className={cn("text-sm", late ? "text-destructive" : "text-muted-foreground")}>
          Previsão de término: {formatDateForDisplay(forecast)}
          {late && dueDate && ` (depois do prazo, ${formatDateForDisplay(dueDate)})`}
        </p>
      )}
    </div>
  );
}
