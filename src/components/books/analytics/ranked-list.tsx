import type { Ranked } from "@/modules/books/analytics";

/**
 * The most read authors or genres (plan 037). Each row says the name and the
 * count in text; the bar only repeats it, so it is hidden from screen readers.
 */
export function RankedList({ items, label }: { items: Ranked[]; label: string }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Nada para mostrar ainda.</p>;
  }
  const most = items[0]?.books ?? 1;
  return (
    <ul className="grid gap-3" aria-label={label}>
      {items.map((item) => (
        <li key={item.name} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium break-words">{item.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {item.books} {item.books === 1 ? "livro" : "livros"}
            </span>
          </div>
          <div aria-hidden="true" className="bg-muted h-2 overflow-hidden rounded-full">
            {/* The width is the data itself, so it goes inline instead of a class. */}
            <div
              className="bg-chart-1 h-full"
              style={{ width: `${Math.round((item.books / most) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
