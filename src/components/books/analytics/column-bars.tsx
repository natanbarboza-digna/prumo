import { useId } from "react";

import { cn } from "@/lib/utils";

export type ColumnBar = {
  key: string;
  /** Under the bar; `labelEvery` hides some on phones. */
  label: string;
  /** In the hidden table, when it needs more than the label ("semana de 09/11"). */
  rowLabel?: string;
  value: number;
  /** Above the bar and in the table ("2", "140"). */
  valueText: string;
};

type ColumnBarsProps = {
  title: string;
  /** The table's columns: what each row is and what it counts. */
  columns: [string, string];
  bars: ColumnBar[];
  /** On phones, show one label in N (from the first), keeping the space. */
  labelEvery?: number;
  /** The same from the `sm` width up. */
  labelEveryWide?: number;
};

/** Hides a label on phones, on wider screens, or both, keeping its space. */
function hideClass(onPhone: boolean, onWide: boolean): string | false {
  if (onPhone && onWide) return "invisible";
  if (onPhone) return "invisible sm:visible";
  return onWide && "sm:invisible";
}

/**
 * Vertical bars in plain CSS (plans 029 and 037): decorative, with the same
 * numbers in a table hidden only visually. A Server Component.
 */
export function ColumnBars({
  title,
  columns,
  bars,
  labelEvery = 1,
  labelEveryWide = 1,
}: ColumnBarsProps) {
  const titleId = useId();
  const highest = Math.max(0, ...bars.map((bar) => bar.value));

  return (
    <figure aria-labelledby={titleId} className="space-y-2">
      <figcaption id={titleId} className="text-sm font-medium">
        {title}
      </figcaption>
      <div aria-hidden="true" className="flex items-end gap-1">
        {bars.map((bar, index) => {
          const hidden = hideClass(index % labelEvery !== 0, index % labelEveryWide !== 0);
          return (
            <div key={bar.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className={cn("text-muted-foreground text-xs tabular-nums", hidden)}>
                {bar.value > 0 ? bar.valueText : " "}
              </span>
              <div className="bg-muted flex h-24 w-full items-end overflow-hidden rounded-sm">
                {bar.value > 0 && (
                  // The height is the data itself, so it goes inline instead of a class.
                  <div
                    className="bg-chart-1 w-full"
                    style={{ height: `${Math.round((bar.value / highest) * 100)}%` }}
                  />
                )}
              </div>
              <span className={cn("text-muted-foreground text-xs whitespace-nowrap", hidden)}>
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* sr-only on a wrapper, never on the table itself (plan 029). */}
      <div className="sr-only">
        <table>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              <th scope="col">{columns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row">{bar.rowLabel ?? bar.label}</th>
                <td>{bar.valueText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
