// Demo data for the development database (`npm run db:seed:demo`). Every input
// goes through the same Zod schemas and services as the forms, so the business
// rules hold for the demo too. Dates are relative to `today`, so the data never
// gets old: what is overdue is always a few days ago.

import type { RoutineLogStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { addDays, eachDay } from "@/lib/dates";
import { APP_TABLES_QUERY, truncateStatement } from "@/lib/truncate";
import { ensureDefaultCategories } from "@/modules/categories/defaults";
import { listCategories } from "@/modules/categories/service";
import { goalInputSchema } from "@/modules/goals/schemas";
import { createGoal } from "@/modules/goals/service";
import {
  actionInputSchema,
  areaInputSchema,
  checkInInputSchema,
  cycleInputSchema,
} from "@/modules/pdi/schemas";
import {
  closeCycle,
  createAction,
  createArea,
  createCheckIn,
  createCycle,
} from "@/modules/pdi/service";
import { isScheduledOn } from "@/modules/routines/rules";
import { routineInputSchema, routineLogInputSchema } from "@/modules/routines/schemas";
import { createRoutine, logRoutine } from "@/modules/routines/service";
import { trackInputSchema, trackStepInputSchema } from "@/modules/tracks/schemas";
import { createStep, createTrack } from "@/modules/tracks/service";

export type DemoSummary = {
  goals: number;
  tracks: number;
  steps: number;
  routines: number;
  logs: number;
  cycles: number;
  areas: number;
  actions: number;
  checkIns: number;
};

export class DemoDataExistsError extends Error {
  constructor() {
    super("O banco já tem dados. Use --reset para apagar tudo e recriar a demonstração.");
    this.name = "DemoDataExistsError";
  }
}

/** Refuses to seed over real data: goals, tracks, routines or cycles. Categories are fine. */
export async function assertCanSeed(): Promise<void> {
  const counts = await Promise.all([
    db.goal.count(),
    db.track.count(),
    db.routine.count(),
    db.pdiCycle.count(),
  ]);
  if (counts.some((count) => count > 0)) throw new DemoDataExistsError();
}

/** Deletes every row of every app table, then recreates the default categories. */
export async function resetAllData(): Promise<void> {
  const rows = await db.$queryRawUnsafe<{ tablename: string }[]>(APP_TABLES_QUERY);
  const statement = truncateStatement(rows.map(({ tablename }) => tablename));
  if (statement !== null) await db.$executeRawUnsafe(statement);
  await ensureDefaultCategories(db);
}

/**
 * Which scheduled days were done ("D"), skipped ("S") or left without a log
 * ("-"), repeated in order. Fixed patterns keep every run the same.
 */
type LogPattern = string;

const SKIP_NOTES = [
  "Dia corrido no trabalho.",
  "Viagem.",
  "Não me senti bem.",
  "Reunião até tarde.",
];

export async function seedDemo(today: string): Promise<DemoSummary> {
  const day = (offset: number) => addDays(today, offset);
  const summary: DemoSummary = {
    goals: 0,
    tracks: 0,
    steps: 0,
    routines: 0,
    logs: 0,
    cycles: 0,
    areas: 0,
    actions: 0,
    checkIns: 0,
  };

  await ensureDefaultCategories(db);
  const categories = await listCategories();
  const categoryId = (name: string) => {
    const category = categories.find((item) => item.name === name);
    if (!category) throw new Error(`Default category missing: ${name}`);
    return category.id;
  };

  // --- Goals ---------------------------------------------------------------

  const goal = async (title: string, status: string, targetDate?: string, description?: string) => {
    summary.goals++;
    return createGoal(goalInputSchema.parse({ title, status, targetDate, description }));
  };
  const english = await goal(
    "Conduzir reuniões em inglês",
    "IN_PROGRESS",
    day(12),
    "Apresentar o status do projeto em inglês na reunião semanal com o time de fora.",
  );
  const nextjs = await goal("Migrar o projeto pessoal para Next.js", "IN_PROGRESS");
  await goal("Tirar a certificação AWS", "NOT_STARTED", day(90));
  const studies = await goal("Organizar a rotina de estudos", "DONE");

  // --- Tracks --------------------------------------------------------------

  const track = async (
    title: string,
    goalId: string | undefined,
    steps: { title: string; status?: string; dueDate?: string; resourceUrl?: string }[],
  ) => {
    summary.tracks++;
    const created = await createTrack(
      trackInputSchema.parse({ title, goalId, description: undefined }),
    );
    for (const step of steps) {
      summary.steps++;
      await createStep(created.id, trackStepInputSchema.parse(step));
    }
    return created;
  };
  await track("Inglês para reuniões", english.id, [
    { title: "Revisar tempos verbais", status: "DONE" },
    { title: "Vocabulário de reuniões", status: "DONE" },
    { title: "Simular uma daily em inglês", status: "IN_PROGRESS", dueDate: day(5) },
    { title: "Gravar uma apresentação de 5 minutos", dueDate: day(-3) },
    { title: "Apresentar o status semanal" },
  ]);
  await track("Next.js App Router", nextjs.id, [
    { title: "Tutorial oficial do App Router", status: "DONE" },
    { title: "Server Actions e formulários", status: "IN_PROGRESS", dueDate: day(10) },
    {
      title: "Cache Components",
      resourceUrl: "https://nextjs.org/docs/app/getting-started/cache-components",
    },
    { title: "Migrar a primeira página" },
  ]);
  await track("Fundamentos de AWS", undefined, [
    { title: "IAM e contas" },
    { title: "EC2 e VPC" },
    { title: "S3 e CloudFront" },
  ]);

  // --- Routines --------------------------------------------------------------

  const routine = async (
    fields: {
      title: string;
      weekdays: string[];
      timeOfDay?: string;
      startDate: string;
      endDate?: string;
      goalId?: string;
    },
    pattern: LogPattern,
    pdiActionId: string | null = null,
  ) => {
    summary.routines++;
    const created = await createRoutine(routineInputSchema.parse(fields), pdiActionId);
    // Every scheduled day up to yesterday (today is left for the user to log).
    const last = created.endDate !== null && created.endDate < day(-1) ? created.endDate : day(-1);
    const scheduled = eachDay(created.startDate, last).filter((date) =>
      isScheduledOn(created, date),
    );
    for (const [index, date] of scheduled.entries()) {
      const mark = pattern[index % pattern.length];
      if (mark === "-") continue;
      const status: RoutineLogStatus = mark === "S" ? "SKIPPED" : "DONE";
      const note = status === "SKIPPED" ? SKIP_NOTES[index % SKIP_NOTES.length] : undefined;
      await logRoutine(created.id, date, routineLogInputSchema.parse({ status, note }), today);
      summary.logs++;
    }
    return created;
  };
  const everyDay = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  await routine(
    {
      title: "Ler 20 minutos",
      weekdays: everyDay,
      timeOfDay: "07:00",
      startDate: day(-40),
      goalId: studies.id,
    },
    "DDDSDDD-DD",
  );
  await routine(
    {
      title: "Exercício",
      weekdays: ["MON", "WED", "FRI"],
      timeOfDay: "18:30",
      startDate: day(-30),
    },
    "DD-DS",
  );
  await routine(
    {
      title: "Flashcards de inglês",
      weekdays: ["MON", "TUE", "WED", "THU", "FRI"],
      startDate: day(-20),
      goalId: english.id,
    },
    "DDDD-",
  );
  await routine(
    { title: "Meditação", weekdays: everyDay, startDate: day(-60), endDate: day(-31) },
    "DD-D",
  );

  // --- PDI -------------------------------------------------------------------

  const cycle = async (fields: Record<string, string | undefined>) => {
    summary.cycles++;
    return createCycle(cycleInputSchema.parse(fields));
  };
  const area = async (cycleId: string, name: string, description?: string) => {
    summary.areas++;
    return createArea(cycleId, areaInputSchema.parse({ name, description }));
  };
  const action = async (cycleId: string, fields: Record<string, string | undefined>) => {
    summary.actions++;
    return createAction(cycleId, actionInputSchema.parse(fields));
  };
  const checkIn = async (cycleId: string, fields: Record<string, string | undefined>) => {
    summary.checkIns++;
    return createCheckIn(cycleId, checkInInputSchema.parse(fields));
  };

  // The previous cycle: created active, filled in, then closed (read-only).
  const previous = await cycle({
    title: "PDI 2025/2",
    startDate: day(-240),
    endDate: day(-61),
    status: "ACTIVE",
    managerName: "Mariana Souza",
    careerObjective: "Chegar a desenvolvedor pleno, com autonomia nas entregas do time.",
    selfAssessment:
      "Evoluí bem em testes e revisão de código; ainda falta falar mais nas reuniões.",
    managerFeedback: "Entregas consistentes. Próximo passo: comunicação e visibilidade.",
    finalRating: "Atende plenamente",
  });
  const quality = await area(previous.id, "Qualidade de código");
  await action(previous.id, {
    areaId: quality.id,
    categoryId: categoryId("Curso"),
    title: "Curso de testes automatizados",
    status: "DONE",
    evidence: "Certificado e testes adicionados ao serviço de pagamentos.",
  });
  await action(previous.id, {
    areaId: quality.id,
    categoryId: categoryId("Prática"),
    title: "Revisar dois PRs por semana",
    status: "DONE",
  });
  await action(previous.id, {
    areaId: quality.id,
    categoryId: categoryId("Leitura"),
    title: "Ler 'Código Limpo'",
    status: "CANCELLED",
    managerComment: "Trocado pelo curso de testes, mais urgente para o time.",
  });
  await checkIn(previous.id, {
    date: day(-150),
    summary: "Meio do ciclo: curso de testes concluído, revisões em dia.",
  });
  await closeCycle(previous.id);

  const current = await cycle({
    title: "PDI 2026/1",
    startDate: day(-60),
    endDate: day(120),
    status: "ACTIVE",
    managerName: "Mariana Souza",
    careerObjective: "Ganhar visibilidade técnica e conduzir reuniões com o time internacional.",
  });
  const communication = await area(
    current.id,
    "Comunicação",
    "Falar com segurança em reuniões, em português e em inglês.",
  );
  const leadership = await area(current.id, "Liderança técnica");
  const presentations = await action(current.id, {
    areaId: communication.id,
    categoryId: categoryId("Prática"),
    title: "Praticar apresentações em inglês",
    expectedResult: "Apresentar o status semanal sem roteiro escrito.",
    dueDate: day(45),
    status: "IN_PROGRESS",
    goalId: english.id,
  });
  await routine(
    { title: "Ensaiar apresentação", weekdays: ["TUE", "THU"], startDate: day(-30) },
    "DDSD",
    presentations.id,
  );
  await action(current.id, {
    areaId: communication.id,
    categoryId: categoryId("Curso"),
    title: "Curso de comunicação assertiva",
    dueDate: day(-2),
  });
  await action(current.id, {
    areaId: leadership.id,
    categoryId: categoryId("Mentoria"),
    title: "Mentoria com tech lead",
    dueDate: day(7),
    status: "IN_PROGRESS",
  });
  await action(current.id, {
    areaId: leadership.id,
    categoryId: categoryId("Leitura"),
    title: "Ler 'O Programador Pragmático'",
    status: "DONE",
    evidence: "Resumo dos capítulos compartilhado no canal do time.",
    managerComment: "Ótimo resumo, gerou boa discussão.",
  });
  await checkIn(current.id, {
    date: day(-45),
    summary: "Início do ciclo: definidas as áreas e as primeiras ações.",
    nextSteps: "Começar a rotina de ensaio e marcar a mentoria.",
  });
  await checkIn(current.id, {
    date: day(-15),
    summary: "Ensaios em andamento; o curso de comunicação está atrasado.",
    nextSteps: "Terminar o curso antes do próximo check-in.",
    managerNotes: "Trazer uma apresentação gravada na próxima conversa.",
  });

  await cycle({ title: "PDI 2026/2", startDate: day(121), endDate: day(300), status: "PLANNED" });

  return summary;
}
