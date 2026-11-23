// Test data written straight to the test database (plan 018). The e2e tests use
// these for setup that is not what they test, and open the page by its URL;
// creating things through the forms stays in one test per entity.
//
// Plain SQL, like seedTestDatabase: Playwright's CommonJS loader cannot import
// the generated Prisma client (an ES module). Relative imports only, for the
// same reason. src/test/e2e-factories.int.test.ts reads what these write with
// the app's services, so a column change in the schema shows up there first.
import { Client } from "pg";

import { readTestDatabaseUrl } from "../src/test/test-database";

type Status = string;

async function run<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: readTestDatabaseUrl() });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function insert(
  client: Client,
  table: string,
  values: Record<string, unknown>,
): Promise<string> {
  const columns = Object.keys(values);
  const params = columns.map((_, index) => `$${index + 1}`);
  // Table and column names below are fixed in this file, never user input.
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO ${table} (id, ${columns.join(", ")}, created_at, updated_at)
     VALUES (uuidv7(), ${params.join(", ")}, now(), now())
     RETURNING id`,
    Object.values(values),
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`Insert into ${table} returned no id`);
  return id;
}

/** The id of a category by name (the default ones come from resetDatabase). */
export function categoryId(name: string): Promise<string> {
  return run(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM action_categories WHERE name = $1",
      [name],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error(`No category named ${name}`);
    return id;
  });
}

export type GoalData = {
  title: string;
  status?: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  targetDate?: string | null;
  description?: string | null;
};

export function insertGoal(goal: GoalData): Promise<string> {
  return run((client) =>
    insert(client, "goals", {
      title: goal.title,
      description: goal.description ?? null,
      status: goal.status ?? "NOT_STARTED",
      target_date: goal.targetDate ?? null,
    }),
  );
}

export type StepData = {
  title: string;
  status?: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
  dueDate?: string | null;
  resourceUrl?: string | null;
};

/** A track and its steps, in order. Returns the track id and the step ids. */
export function insertTrack(track: {
  title: string;
  goalId?: string | null;
  steps?: StepData[];
  /** When it was archived (plan 024); omitted, the track is active. */
  archivedAt?: Date | null;
}): Promise<{ id: string; stepIds: string[] }> {
  return run(async (client) => {
    const id = await insert(client, "tracks", {
      title: track.title,
      description: null,
      goal_id: track.goalId ?? null,
      // The column has no time zone and Prisma keeps it in UTC: send the UTC
      // ISO string, whose "Z" Postgres ignores for such columns.
      archived_at: track.archivedAt ? track.archivedAt.toISOString() : null,
    });
    const stepIds: string[] = [];
    for (const [index, step] of (track.steps ?? []).entries()) {
      stepIds.push(
        await insert(client, "track_steps", {
          track_id: id,
          title: step.title,
          position: index + 1,
          status: step.status ?? "NOT_STARTED",
          due_date: step.dueDate ?? null,
          resource_url: step.resourceUrl ?? null,
          notes: null,
        }),
      );
    }
    return { id, stepIds };
  });
}

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export type RoutineData = {
  title: string;
  startDate: string;
  /** Fixed days ("MON"...); every day when omitted. Ignored with timesPerWeek. */
  weekdays?: string[];
  /** A weekly goal (plan 017): all seven days are stored, like the app does. */
  timesPerWeek?: number | null;
  endDate?: string | null;
  timeOfDay?: string | null;
  goalId?: string | null;
  pdiActionId?: string | null;
  logs?: { date: string; status?: "DONE" | "SKIPPED"; note?: string | null }[];
};

export function insertRoutine(routine: RoutineData): Promise<string> {
  return run(async (client) => {
    const weekly = routine.timesPerWeek ?? null;
    const weekdays = weekly ? ALL_DAYS : (routine.weekdays ?? ALL_DAYS);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO routines (id, title, description, weekdays, times_per_week, time_of_day,
         start_date, end_date, goal_id, pdi_action_id, created_at, updated_at)
       VALUES (uuidv7(), $1, NULL, $2::weekday[], $3, $4, $5, $6, $7, $8, now(), now())
       RETURNING id`,
      [
        routine.title,
        weekdays,
        weekly,
        routine.timeOfDay ?? null,
        routine.startDate,
        routine.endDate ?? null,
        routine.goalId ?? null,
        routine.pdiActionId ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("Insert into routines returned no id");
    for (const log of routine.logs ?? []) {
      await insert(client, "routine_logs", {
        routine_id: id,
        date: log.date,
        status: log.status ?? "DONE",
        note: log.note ?? null,
      });
    }
    return id;
  });
}

export type ActionData = {
  title: string;
  category: string;
  status?: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  dueDate?: string | null;
  goalId?: string | null;
  description?: string | null;
  expectedResult?: string | null;
};

export type CycleData = {
  title: string;
  startDate: string;
  endDate: string;
  status?: "PLANNED" | "ACTIVE" | "CLOSED";
  managerName?: string | null;
  areas?: { name: string; actions?: ActionData[] }[];
  checkIns?: { date: string; summary: string }[];
};

/**
 * A PDI cycle with its areas, actions and check-ins. Returns the cycle id and
 * the action ids by title, to open an action page directly.
 */
export function insertCycle(
  cycle: CycleData,
): Promise<{ id: string; areaIds: string[]; actionIds: Record<string, string> }> {
  return run(async (client) => {
    const id = await insert(client, "pdi_cycles", {
      title: cycle.title,
      start_date: cycle.startDate,
      end_date: cycle.endDate,
      status: (cycle.status ?? "PLANNED") as Status,
      manager_name: cycle.managerName ?? null,
    });
    const areaIds: string[] = [];
    const actionIds: Record<string, string> = {};
    // Areas and actions keep the order they are given in (plan 021).
    for (const [areaIndex, area] of (cycle.areas ?? []).entries()) {
      const areaId = await insert(client, "pdi_areas", {
        cycle_id: id,
        name: area.name,
        position: areaIndex + 1,
      });
      areaIds.push(areaId);
      for (const [actionIndex, action] of (area.actions ?? []).entries()) {
        const { rows } = await client.query<{ id: string }>(
          "SELECT id FROM action_categories WHERE name = $1",
          [action.category],
        );
        const category = rows[0]?.id;
        if (!category) throw new Error(`No category named ${action.category}`);
        actionIds[action.title] = await insert(client, "pdi_actions", {
          area_id: areaId,
          category_id: category,
          title: action.title,
          description: action.description ?? null,
          expected_result: action.expectedResult ?? null,
          due_date: action.dueDate ?? null,
          status: action.status ?? "NOT_STARTED",
          goal_id: action.goalId ?? null,
          position: actionIndex + 1,
        });
      }
    }
    for (const checkIn of cycle.checkIns ?? []) {
      await insert(client, "pdi_check_ins", {
        cycle_id: id,
        date: checkIn.date,
        summary: checkIn.summary,
      });
    }
    return { id, areaIds, actionIds };
  });
}

/** "08:15" → 495, the way time_days and time_entries store times of day. */
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export type TimeEntryData = {
  /** "HH:MM". */
  start: string;
  minutes: number;
  kind?: "WORK" | "BREAK";
  description?: string | null;
  /** Name of a time category (the seed creates the defaults). */
  category?: string;
  /** Name of a project, created when new. */
  project?: string;
};

/** A time tracking day with its entries (plan 031). */
export function insertTimeDay(day: {
  date: string;
  start: string;
  end?: string | null;
  slotMinutes?: 15 | 30 | 60;
  entries?: TimeEntryData[];
}): Promise<string> {
  return run(async (client) => {
    const id = await insert(client, "time_days", {
      date: day.date,
      start_minute: minutesOf(day.start),
      end_minute: day.end ? minutesOf(day.end) : null,
      slot_minutes: day.slotMinutes ?? 30,
    });
    for (const entry of day.entries ?? []) {
      const kind = entry.kind ?? "WORK";
      let categoryIdValue: string | null = null;
      if (kind === "WORK") {
        const { rows } = await client.query<{ id: string }>(
          "SELECT id FROM time_categories WHERE name = $1",
          [entry.category ?? "Projeto"],
        );
        categoryIdValue = rows[0]?.id ?? null;
        if (!categoryIdValue) throw new Error(`No time category named ${entry.category}`);
      }
      let projectId: string | null = null;
      if (entry.project) {
        const { rows } = await client.query<{ id: string }>(
          "SELECT id FROM time_projects WHERE name = $1",
          [entry.project],
        );
        projectId =
          rows[0]?.id ??
          (await insert(client, "time_projects", { name: entry.project, archived: false }));
      }
      await insert(client, "time_entries", {
        day_id: id,
        start_minute: minutesOf(entry.start),
        minutes: entry.minutes,
        kind,
        description: entry.description ?? (kind === "WORK" ? "Trabalho" : null),
        category_id: categoryIdValue,
        project_id: projectId,
      });
    }
    return id;
  });
}
