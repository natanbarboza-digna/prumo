import { durationText } from "@/modules/time/labels";
import type { Share } from "@/modules/time/analytics";

/**
 * Work split by category or project (plan 032). Each row says the name, the
 * hours and the percentage in text; the bar only repeats it, so it is hidden
 * from screen readers.
 */
export function ShareBars({
  shares,
  emptyName,
  label,
}: {
  shares: Share[];
  emptyName: string;
  label: string;
}) {
  return (
    <ul className="grid gap-3" aria-label={label}>
      {shares.map((share) => (
        <li key={share.id ?? "none"} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium break-words">{share.name ?? emptyName}</span>
            <span className="text-muted-foreground tabular-nums">
              {durationText(share.minutes)} · {share.percent}%
            </span>
          </div>
          <div aria-hidden="true" className="bg-muted h-2 overflow-hidden rounded-full">
            {/* The width is the data itself, so it goes inline instead of a class. */}
            <div className="bg-primary h-full" style={{ width: `${share.percent}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
