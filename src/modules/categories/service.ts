import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/form-fields";
import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from "@/lib/prisma-errors";
import type { CategoryInput } from "@/modules/categories/schemas";

export type ActionCategory = {
  id: string;
  name: string;
  /** What enables creating a routine from an action (roadmap step 5). */
  allowsRoutine: boolean;
  archived: boolean;
  actionCount: number;
};

export class CategoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Action category not found: ${id}`);
    this.name = "CategoryNotFoundError";
  }
}

export class CategoryNameTakenError extends Error {
  constructor(name: string) {
    super(`Action category name already taken: ${name}`);
    this.name = "CategoryNameTakenError";
  }
}

export class CategoryInUseError extends Error {
  constructor(id: string) {
    super(`Action category is used by actions and can only be archived: ${id}`);
    this.name = "CategoryInUseError";
  }
}

const withCount = { _count: { select: { actions: true } } } satisfies Prisma.ActionCategoryInclude;

type CategoryRow = Prisma.ActionCategoryGetPayload<{ include: typeof withCount }>;

/** Active categories first, then archived ones, each group by name. */
export async function listCategories(
  options: { includeArchived?: boolean } = {},
): Promise<ActionCategory[]> {
  const rows = await db.actionCategory.findMany({
    where: options.includeArchived === false ? { archived: false } : {},
    include: withCount,
    orderBy: [{ archived: "asc" }, { name: "asc" }],
  });
  return rows.map(toCategory);
}

export async function getCategory(id: string): Promise<ActionCategory> {
  if (!isUuid(id)) throw new CategoryNotFoundError(id);
  const row = await db.actionCategory.findUnique({ where: { id }, include: withCount });
  if (!row) throw new CategoryNotFoundError(id);
  return toCategory(row);
}

export async function createCategory(input: CategoryInput): Promise<ActionCategory> {
  await assertNameAvailable(input.name);
  return saveName(input.name, () => db.actionCategory.create({ data: input, include: withCount }));
}

export async function updateCategory(id: string, input: CategoryInput): Promise<ActionCategory> {
  if (!isUuid(id)) throw new CategoryNotFoundError(id);
  await assertNameAvailable(input.name, id);
  return withNotFound(id, () =>
    saveName(input.name, () =>
      db.actionCategory.update({ where: { id }, data: input, include: withCount }),
    ),
  );
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<ActionCategory> {
  if (!isUuid(id)) throw new CategoryNotFoundError(id);
  return withNotFound(id, async () =>
    toCategory(
      await db.actionCategory.update({ where: { id }, data: { archived }, include: withCount }),
    ),
  );
}

/** Only a category no action uses can be deleted; the others can be archived. */
export async function deleteCategory(id: string): Promise<void> {
  const category = await getCategory(id);
  if (category.actionCount > 0) throw new CategoryInUseError(id);
  try {
    await db.actionCategory.delete({ where: { id } });
  } catch (error) {
    // An action created in the meantime: the database's Restrict rule caught it.
    if (isForeignKeyViolation(error)) throw new CategoryInUseError(id);
    if (isRecordNotFound(error)) throw new CategoryNotFoundError(id);
    throw error;
  }
}

/** Names are unique ignoring case: "prática" clashes with "Prática". */
async function assertNameAvailable(name: string, exceptId?: string): Promise<void> {
  const clash = await db.actionCategory.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  if (clash) throw new CategoryNameTakenError(name);
}

async function saveName(name: string, operation: () => Promise<CategoryRow>) {
  try {
    return toCategory(await operation());
  } catch (error) {
    if (isUniqueViolation(error)) throw new CategoryNameTakenError(name);
    throw error;
  }
}

async function withNotFound<T>(id: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isRecordNotFound(error)) throw new CategoryNotFoundError(id);
    throw error;
  }
}

function toCategory(row: CategoryRow): ActionCategory {
  return {
    id: row.id,
    name: row.name,
    allowsRoutine: row.allowsRoutine,
    archived: row.archived,
    actionCount: row._count.actions,
  };
}
