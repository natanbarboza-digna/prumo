import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { AnalyticsFilters, periodLabels } from "@/components/time/analytics/analytics-filters";
import { ShareBars } from "@/components/time/analytics/share-bars";
import { formatDateForDisplay, formatLongDate, todayInAppTimeZone } from "@/lib/dates";
import { minutesNowInAppTimeZone } from "@/lib/time-of-day";
import { computeAnalytics } from "@/modules/time/analytics";
import { durationText } from "@/modules/time/labels";
import { analyticsQuery } from "@/modules/time/period";
import { listTimeCategories, listTimeDays, listTimeProjects } from "@/modules/time/service";

export const metadata: Metadata = { title: "Analíticos de tempo" };

/** Time analytics (plan 032): ?periodo=, ?de=, ?ate=, ?categoria=, ?projeto=. */
export default async function TimeAnalyticsPage({ searchParams }: PageProps<"/time/analytics">) {
  const params = await searchParams;
  // "Now" is read before the database (today's open day counts up to now).
  await connection();
  const now = new Date();
  const today = todayInAppTimeZone(now);
  const query = analyticsQuery(params, today);

  const [days, categories, projects] = await Promise.all([
    listTimeDays(query.from, query.to),
    listTimeCategories({ includeArchived: true }),
    listTimeProjects({ includeArchived: true }),
  ]);
  const analytics = computeAnalytics(days, query, {
    today,
    nowMinute: minutesNowInAppTimeZone(now),
  });
  const { totals } = analytics;
  const filtered = totals.filtered !== null;
  const range = `${formatDateForDisplay(query.from)} a ${formatDateForDisplay(query.to)}`;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link href="/time" className="text-muted-foreground text-sm hover:underline">
          ← Tempo
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Analíticos de tempo</h1>
        <p className="text-muted-foreground">
          {periodLabels[query.period]}: {range}
        </p>
      </div>

      <AnalyticsFilters query={query} categories={categories} projects={projects} />

      {totals.days === 0 ? (
        <p>
          Nenhum registro neste período.{" "}
          <Link href="/time" className="underline underline-offset-4">
            Registrar o dia
          </Link>
        </p>
      ) : (
        <>
          <section aria-labelledby="titulo-totais" className="space-y-3 rounded-lg border p-4">
            <h2 id="titulo-totais" className="text-xl font-semibold tracking-tight">
              Totais
            </h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["Dias registrados", String(totals.days)],
                  ["Presença", durationText(totals.presence)],
                  ["Trabalhado", durationText(totals.worked)],
                  ["Pausas", durationText(totals.breaks)],
                  ["Sem registro", durationText(totals.unregistered)],
                  ["Média trabalhada por dia", durationText(totals.averageWorked)],
                  [
                    "Trocas de assunto por dia",
                    String(analytics.averageSwitches).replace(".", ","),
                  ],
                  ...(filtered ? [["Tempo filtrado", durationText(totals.filtered ?? 0)]] : []),
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="space-y-0.5">
                  <dt className="text-muted-foreground text-sm">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {totals.longestDay && (
              <p className="text-sm">
                Dia mais longo:{" "}
                <Link
                  href={`/time?dia=${totals.longestDay.date}`}
                  className="underline underline-offset-4"
                >
                  {formatLongDate(totals.longestDay.date)}
                </Link>{" "}
                ({durationText(totals.longestDay.worked)} trabalhadas)
              </p>
            )}
            {filtered && (
              <p className="text-muted-foreground text-sm">
                Presença, pausas e sem registro são do dia inteiro; o filtro vale para os blocos de
                trabalho.
              </p>
            )}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section
              aria-labelledby="titulo-categorias"
              className="space-y-3 rounded-lg border p-4"
            >
              <h2 id="titulo-categorias" className="text-xl font-semibold tracking-tight">
                Por categoria
              </h2>
              {analytics.byCategory.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum bloco de trabalho.</p>
              ) : (
                <ShareBars
                  shares={analytics.byCategory}
                  emptyName="Sem categoria"
                  label="Por categoria"
                />
              )}
            </section>
            <section aria-labelledby="titulo-projetos" className="space-y-3 rounded-lg border p-4">
              <h2 id="titulo-projetos" className="text-xl font-semibold tracking-tight">
                Por projeto
              </h2>
              {analytics.byProject.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum bloco de trabalho.</p>
              ) : (
                <ShareBars
                  shares={analytics.byProject}
                  emptyName="Sem projeto"
                  label="Por projeto"
                />
              )}
            </section>
          </div>

          <section aria-labelledby="titulo-atividades" className="space-y-3 rounded-lg border p-4">
            <h2 id="titulo-atividades" className="text-xl font-semibold tracking-tight">
              Atividades que mais tomaram tempo
            </h2>
            {analytics.activities.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum bloco de trabalho.</p>
            ) : (
              <ol className="grid gap-2" aria-label="Atividades que mais tomaram tempo">
                {analytics.activities.map((activity) => (
                  <li
                    key={activity.text}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 text-sm last:border-0"
                  >
                    <span className="font-medium break-words">{activity.text}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {durationText(activity.minutes)} · {activity.blocks}{" "}
                      {activity.blocks === 1 ? "bloco" : "blocos"}
                      {activity.category && ` · ${activity.category}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="titulo-dias" className="space-y-3 rounded-lg border p-4">
            <h2 id="titulo-dias" className="text-xl font-semibold tracking-tight">
              Por dia
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Tempo por dia do período</caption>
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th scope="col" className="py-1 pr-3 font-normal">
                      Dia
                    </th>
                    <th scope="col" className="py-1 pr-3 font-normal">
                      Trabalhado
                    </th>
                    <th scope="col" className="py-1 pr-3 font-normal">
                      Pausas
                    </th>
                    <th scope="col" className="py-1 pr-3 font-normal">
                      Sem registro
                    </th>
                    <th scope="col" className="py-1 font-normal">
                      Trocas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.perDay.map((line) => (
                    <tr key={line.date} className="border-t tabular-nums">
                      <th scope="row" className="py-1 pr-3 text-left font-medium">
                        <Link href={`/time?dia=${line.date}`} className="hover:underline">
                          {formatDateForDisplay(line.date).slice(0, 5)}
                        </Link>
                      </th>
                      <td className="py-1 pr-3">{durationText(line.worked)}</td>
                      <td className="py-1 pr-3">{durationText(line.breaks)}</td>
                      <td className="py-1 pr-3">{durationText(line.unregistered)}</td>
                      <td className="py-1">{line.switches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
