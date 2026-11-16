import Link from "next/link";
import type { ReactNode } from "react";

type DashboardCardProps = {
  /** Unique on the page: names the section through its heading. */
  id: string;
  title: string;
  /** A link to the full screen ("Ver todos"), shown next to the title. */
  more?: { href: string; label: string };
  children: ReactNode;
};

/** One dashboard block: a named section with an h2 and an optional "see all" link. */
export function DashboardCard({ id, title, more, children }: DashboardCardProps) {
  const headingId = `titulo-${id}`;
  return (
    <section aria-labelledby={headingId} className="bg-card space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {more && (
          <Link href={more.href} className="text-sm underline-offset-4 hover:underline">
            {more.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** What an empty block says, with the link to its next step. */
export function EmptyCardText({
  text,
  href,
  label,
}: {
  text: string;
  href: string;
  label: string;
}) {
  return (
    <p className="text-muted-foreground text-sm">
      {text}{" "}
      <Link href={href} className="text-foreground underline underline-offset-4">
        {label}
      </Link>
    </p>
  );
}
