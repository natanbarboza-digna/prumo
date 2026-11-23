import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DayGrid } from "@/components/time/day-grid";
import { DayTimesForm, EndDayForm, StartDayForm } from "@/components/time/day-forms";
import { Button } from "@/components/ui/button";
import { addDays, formatLongDate, isValidDateOnly, todayInAppTimeZone } from "@/lib/dates";
import { formatTimeOfDay, isValidTimeOfDay, minutesNowInAppTimeZone } from "@/lib/time-of-day";
import { endDayAction, setDayTimesAction, startDayAction } from "@/modules/time/actions";
import { durationText } from "@/modules/time/labels";
import { daySlots, daySummary, placeEntries } from "@/modules/time/rules";
import {
  clockFor,
  getTimeDay,
  listDescriptions,
  listTimeCategories,
  listTimeProjects,
} from "@/modules/time/service";

export const metadata: Metadata = { title: "Tempo" };

/** The time tracking day (plan 031): ?dia=AAAA-MM-DD, today by default. */
export default async function TimePage({ searchParams }: PageProps<"/time">) {
  const query = await searchParams;
  // "Now" is read before the database, so tell Next this page renders per
  // request instead of prerendering a frozen clock.
  await connection();
  const now = new Date();
  const today = todayInAppTimeZone(now);
  const asked = typeof query.dia === "string" ? query.dia : "";
  // An invalid or future date shows today.
  const date = isValidDateOnly(asked) && asked <= today ? asked : today;
  const splitting =
    typeof query.dividir === "string" && isValidTimeOfDay(query.dividir) ? query.dividir : null;

  const [day, categories, projects, descriptions] = await Promise.all([
    getTimeDay(date),
    listTimeCategories(),
    listTimeProjects(),
    listDescriptions(),
  ]);
  const nowTime = formatTimeOfDay(minutesNowInAppTimeZone(now));

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Tempo</h1>
          <p className="text-muted-foreground first-letter:uppercase">{formatLongDate(date)}</p>
        </div>
        <nav aria-label="Dias" className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/time?dia=${addDays(date, -1)}`}>← Dia anterior</Link>
          </Button>
          {date < today && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/time?dia=${addDays(date, 1)}`}>Próximo dia →</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/time">Hoje</Link>
              </Button>
            </>
          )}
        </nav>
      </div>

      {day === null ? (
        <section aria-labelledby="titulo-comecar" className="space-y-4 rounded-lg border p-4">
          <h2 id="titulo-comecar" className="text-xl font-semibold tracking-tight">
            Começar o dia
          </h2>
          <StartDayForm
            action={startDayAction.bind(null, date)}
            defaultStart={date === today ? nowTime : "08:00"}
            askEnd={date < today}
          />
        </section>
      ) : (
        <TrackedDay
          day={day}
          now={now}
          nowTime={nowTime}
          splitting={splitting}
          categories={categories}
          projects={projects.map((project) => project.name)}
          descriptions={descriptions}
        />
      )}

      <p className="text-muted-foreground flex flex-wrap gap-4 text-sm">
        <Link href="/time/categories" className="underline-offset-4 hover:underline">
          Categorias de tempo
        </Link>
        <Link href="/time/projects" className="underline-offset-4 hover:underline">
          Projetos e clientes
        </Link>
      </p>
    </div>
  );
}

function TrackedDay({
  day,
  now,
  nowTime,
  splitting,
  categories,
  projects,
  descriptions,
}: {
  day: NonNullable<Awaited<ReturnType<typeof getTimeDay>>>;
  now: Date;
  nowTime: string;
  splitting: string | null;
  categories: { id: string; name: string }[];
  projects: string[];
  descriptions: string[];
}) {
  const clock = clockFor(day, now);
  const summary = daySummary(day, day.entries, clock);
  const slots = placeEntries(daySlots(day, clock), day.entries);

  return (
    <>
      <section aria-labelledby="titulo-resumo" className="space-y-3 rounded-lg border p-4">
        <h2 id="titulo-resumo" className="text-xl font-semibold tracking-tight">
          Resumo do dia
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Presença", summary.presence],
            ["Trabalhado", summary.worked],
            ["Pausas", summary.breaks],
            ["Sem registro", summary.unregistered],
          ].map(([label, minutes]) => (
            <div key={label} className="space-y-0.5">
              <dt className="text-muted-foreground text-sm">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {durationText(Number(minutes))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-sm">
          Entrada {day.startTime}
          {day.endTime ? ` · Saída ${day.endTime}` : " · Dia em aberto"} · Blocos de{" "}
          {day.slotMinutes} minutos
        </p>
        {day.endTime === null && (
          <EndDayForm action={endDayAction.bind(null, day.date)} defaultEnd={nowTime} />
        )}
        <details className="text-sm">
          <summary className="cursor-pointer underline-offset-4 hover:underline">
            Corrigir entrada e saída
          </summary>
          <div className="pt-3">
            <DayTimesForm
              action={setDayTimesAction.bind(null, day.date)}
              startTime={day.startTime}
              endTime={day.endTime}
            />
          </div>
        </details>
      </section>

      <section aria-labelledby="titulo-blocos" className="space-y-3">
        <h2 id="titulo-blocos" className="text-xl font-semibold tracking-tight">
          Blocos
        </h2>
        {categories.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nenhuma categoria ativa.{" "}
            <Link href="/time/categories" className="underline underline-offset-4">
              Crie uma categoria
            </Link>{" "}
            para registrar trabalho.
          </p>
        )}
        <DayGrid
          date={day.date}
          slots={slots}
          splitting={splitting}
          categories={categories}
          descriptions={descriptions}
          projects={projects}
        />
      </section>
    </>
  );
}
