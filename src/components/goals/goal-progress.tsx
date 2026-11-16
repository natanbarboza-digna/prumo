import { Progress } from "@/components/ui/progress";
import type { GoalProgress } from "@/modules/goals/service";
import { itemProgressText } from "@/modules/pdi/labels";
import { progressPercent } from "@/modules/tracks/service";

/** Overall progress of a goal (track steps + PDI actions), with the share of each. */
export function GoalProgressSummary({
  progress,
  goalTitle,
}: {
  progress: GoalProgress;
  goalTitle: string;
}) {
  const text = itemProgressText(progress.done, progress.total);
  const percent = progressPercent(progress.done, progress.total);
  return (
    <section aria-labelledby="titulo-progresso" className="space-y-2">
      <h2 id="titulo-progresso" className="text-xl font-semibold tracking-tight">
        Progresso
      </h2>
      <Progress
        value={percent}
        aria-label={`Progresso do objetivo ${goalTitle}`}
        aria-valuetext={`${percent}%: ${text}`}
      />
      <p className="text-sm">{text}</p>
      <p className="text-muted-foreground text-sm">
        Etapas de trilha: {progress.steps.done} de {progress.steps.total} · Ações de PDI:{" "}
        {progress.actions.done} de {progress.actions.total}
      </p>
    </section>
  );
}
