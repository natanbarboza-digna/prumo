import { Prisma } from "@/generated/prisma/client";

/** True for Prisma's "the record to update/delete does not exist" error (P2025). */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
