import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ColumnBars } from "@/components/books/analytics/column-bars";
import { GoalForm } from "@/components/books/analytics/goal-form";
import { RankedList } from "@/components/books/analytics/ranked-list";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { formatDateForDisplay, todayInAppTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setReadingGoalAction } from "@/modules/books/actions";
import { goalProgress, readingAnalytics } from "@/modules/books/analytics";
import { MONTH_SHORT, averageDaysText, goalCountText, goalPaceText } from "@/modules/books/labels";
import { analyticsYear } from "@/modules/books/schemas";
import { getReadingGoal, getReadingYear, readingYears } from "@/modules/books/service";
import { durationText } from "@/modules/time/labels";

export const metadata: Metadata = { title: "Analíticos de leitura" };

const dayMonth = (date: string) => formatDateForDisplay(date).slice(0, 5);

/** Reading analytics and the annual goal (plan 037): ?ano=. */
export default async function ReadingAnalyticsPage({
  searchParams,
}: PageProps<"/books/analytics">) {
  const params = await searchParams;
  // "Today" is read before the database (the goal's pace and the last weeks).
  await connection();
  const today = todayInAppTimeZone();
  const year = analyticsYear(params.ano, today);

  const [data, years, goal] = await Promise.all([
    getReadingYear(),
    readingYears(today),
    getReadingGoal(year),
  ]);
  const analytics = readingAnalytics(data.books, data.logs, year, today);
  const progress =
    goal === null ? null : goalProgress({ target: goal.books, read: analytics.read, year }, today);
  const percent =
    progress === null ? 0 : Math.min(100, Math.round((progress.read / progress.target) * 100));
  const empty =
    analytics.read === 0 &&
    analytics.abandoned === 0 &&
    analytics.pages === 0 &&
    analytics.minutes === 0;
  const { duration } = analytics;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-2">
        <Link href="/books" className="text-muted-foreground text-sm hover:underline">
          ← Leituras
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Analíticos de leitura</h1>
      </div>

      <nav aria-label="Ano">
        <ul className="flex flex-wrap gap-2">
          {years.map((option) => (
            <li key={option}>
              <Link
                href={`/books/analytics?ano=${option}`}
                aria-current={option === year ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex h-8 items-center rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]",
                  option === year
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {option}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="titulo-meta" className="bg-card space-y-4 rounded-lg border p-4">
        <h2 id="titulo-meta" className="text-xl font-semibold tracking-tight">
          Meta de {year}
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          {progress && (
            <div className="flex items-center gap-4">
              <ProgressRing percent={percent} label={`${goalCountText(progress)} da meta`} />
              <div className="space-y-1 text-sm">
                <p className="font-medium">{goalCountText(progress)}</p>
                <p
                  className={cn(
                    progress.ahead !== null && progress.ahead < 0 && "text-destructive",
                  )}
                >
                  {goalPaceText(progress)}
                </p>
              </div>
            </div>
          )}
          <GoalForm action={setReadingGoalAction} year={year} books={goal?.books ?? null} />
        </div>
      </section>

      {empty ? (
        <p className="text-muted-foreground">
          Nenhuma leitura registrada em {year}.{" "}
          <Link href="/books" className="text-foreground underline underline-offset-4">
            Ir para Leituras
          </Link>
        </p>
      ) : (
        <>
          <section aria-labelledby="titulo-numeros" className="space-y-3">
            <h2 id="titulo-numeros" className="text-xl font-semibold tracking-tight">
              {year} em números
            </h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Lidos", String(analytics.read)],
                ["Abandonados", String(analytics.abandoned)],
                ["Páginas lidas", analytics.pages.toLocaleString("pt-BR")],
                ["Horas ouvidas", analytics.minutes === 0 ? "0h" : durationText(analytics.minutes)],
                [
                  "Nota média",
                  analytics.averageRating === null
                    ? "—"
                    : `★ ${analytics.averageRating.toLocaleString("pt-BR")}`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="bg-card rounded-lg border p-4">
                  <dt className="text-muted-foreground text-sm">{label}</dt>
                  <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <ColumnBars
              title="Livros lidos por mês"
              columns={["Mês", "Livros"]}
              labelEvery={2}
              bars={analytics.byMonth.map((books, index) => ({
                key: MONTH_SHORT[index]!,
                label: MONTH_SHORT[index]!,
                value: books,
                valueText: String(books),
              }))}
            />
            <ColumnBars
              title="Páginas por semana (últimas 12)"
              columns={["Semana", "Páginas"]}
              labelEvery={3}
              labelEveryWide={2}
              bars={analytics.weeklyPages.map((week) => ({
                key: week.monday,
                label: dayMonth(week.monday),
                rowLabel: `Semana de ${dayMonth(week.monday)}`,
                value: week.pages,
                valueText: String(week.pages),
              }))}
            />
          </div>

          <section aria-labelledby="titulo-tempo" className="space-y-2">
            <h2 id="titulo-tempo" className="text-xl font-semibold tracking-tight">
              Tempo por livro
            </h2>
            {duration.average === null ? (
              <p className="text-muted-foreground text-sm">
                Nenhum livro lido com início e término em {year}.
              </p>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="text-2xl font-semibold tracking-tight">
                  {averageDaysText(duration.average)}
                </p>
                {duration.fastest && duration.slowest && duration.fastest !== duration.slowest && (
                  <p className="text-muted-foreground">
                    Mais rápido: {duration.fastest.title} ({duration.fastest.days}{" "}
                    {duration.fastest.days === 1 ? "dia" : "dias"}) · Mais demorado:{" "}
                    {duration.slowest.title} ({duration.slowest.days}{" "}
                    {duration.slowest.days === 1 ? "dia" : "dias"})
                  </p>
                )}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section aria-labelledby="titulo-autores" className="space-y-3">
              <h2 id="titulo-autores" className="text-xl font-semibold tracking-tight">
                Autores mais lidos
              </h2>
              <RankedList items={analytics.topAuthors} label="Autores mais lidos" />
            </section>
            <section aria-labelledby="titulo-generos" className="space-y-3">
              <h2 id="titulo-generos" className="text-xl font-semibold tracking-tight">
                Gêneros mais lidos
              </h2>
              <RankedList items={analytics.topGenres} label="Gêneros mais lidos" />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
