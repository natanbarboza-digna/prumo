import { Progress } from "@/components/ui/progress";
import { actionProgressText } from "@/modules/pdi/labels";
import { progressPercent } from "@/modules/tracks/service";

type ActionProgressBarProps = {
  done: number;
  total: number;
  /** What the bar measures, for screen readers (e.g. "Progresso do ciclo PDI 2026"). */
  label: string;
};

export function ActionProgressBar({ done, total, label }: ActionProgressBarProps) {
  const text = actionProgressText(done, total);
  const percent = progressPercent(done, total);
  return (
    <div className="space-y-1.5">
      <Progress value={percent} aria-label={label} aria-valuetext={`${percent}%: ${text}`} />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}
