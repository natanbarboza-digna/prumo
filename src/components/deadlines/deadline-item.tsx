import Link from "next/link";

import { deadlineKindLabels, dueText } from "@/modules/dashboard/labels";
import type { Deadline } from "@/modules/dashboard/rules";

/** One deadline: kind and source, title with link, and when it is due. Dashboard and /deadlines. */
export function DeadlineItem({ item, today }: { item: Deadline; today: string }) {
  return (
    <li className="space-y-0.5 rounded-md border p-3 text-sm">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        {deadlineKindLabels[item.kind]}
        {item.source && ` · ${item.source}`}
      </p>
      <p className="font-medium break-words">
        <Link href={item.href} className="hover:underline">
          {item.title}
        </Link>
      </p>
      <p className={item.date < today ? "text-destructive" : "text-muted-foreground"}>
        {dueText(item.date, today)}
      </p>
    </li>
  );
}
