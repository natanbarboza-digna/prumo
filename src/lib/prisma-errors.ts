import { Prisma } from "@/generated/prisma/client";

/** True for Prisma's "the record to update/delete does not exist" error (P2025). */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/** True for a unique constraint violation (P2002), e.g. two saves racing for the same name. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** True for a foreign key violation (P2003), e.g. deleting a row still referenced (Restrict). */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}
