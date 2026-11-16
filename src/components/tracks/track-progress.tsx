import { Progress } from "@/components/ui/progress";
import { stepProgressText } from "@/modules/tracks/labels";
import { progressPercent } from "@/modules/tracks/service";

type TrackProgressProps = {
  done: number;
  total: number;
  /** What the bar measures, for screen readers (e.g. "Progresso da trilha React"). */
  label: string;
};

export function TrackProgress({ done, total, label }: TrackProgressProps) {
  const text = stepProgressText(done, total);
  return (
    <div className="space-y-1.5">
      <Progress
        value={progressPercent(done, total)}
        aria-label={label}
        aria-valuetext={`${progressPercent(done, total)}%: ${text}`}
      />
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}
