import { Progress } from "@/components/ui/progress";
import { adherenceText } from "@/modules/routines/labels";
import { ADHERENCE_DAYS, type Adherence } from "@/modules/routines/rules";

type AdherenceMeterProps = {
  adherence: Adherence;
  /** What the bar measures, for screen readers (e.g. "Adesão da rotina Ler"). */
  label: string;
  /** The period the numbers cover; the last 30 days by default. */
  periodText?: string;
};

export function AdherenceMeter({
  adherence,
  label,
  periodText = `últimos ${ADHERENCE_DAYS} dias`,
}: AdherenceMeterProps) {
  const summary = adherenceText(adherence);
  const text = adherence.scheduled === 0 ? summary : `${summary}, ${adherence.rate}%`;
  return (
    <div className="space-y-1.5">
      <Progress
        value={adherence.rate}
        aria-label={label}
        aria-valuetext={`${adherence.rate}%: ${summary}`}
      />
      <p className="text-muted-foreground text-sm">
        {text} <span className="whitespace-nowrap">({periodText})</span>
      </p>
    </div>
  );
}
