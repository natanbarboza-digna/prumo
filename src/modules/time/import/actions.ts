"use server";
// Server Action for the time history import (plan 033). The pasted text is
// untrusted input: its size is checked here, its content by the service.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/modules/auth/session";
import {
  type TimeImportInput,
  type TimeImportIssue,
  type TimeImportPreview,
  importTimeHistory,
  previewTimeImport,
} from "@/modules/time/import/service";

export type TimeImportState = {
  issues?: TimeImportIssue[];
  preview?: TimeImportPreview;
};

// A "use server" file may only export async functions, so these stay private.
const MAX_TEXT_BYTES = 200 * 1024;
const SLOT_SIZES = new Set([15, 30, 60]);

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

const formIssue = (message: string): TimeImportState => ({
  issues: [{ source: "form", line: null, message }],
});

/**
 * Two steps on the same text, like the PDI import: `intent=preview` only reads
 * and checks; `intent=confirm` checks again from scratch and writes. The
 * browser sends the whole form both times, so nothing waits on the server.
 */
export async function importTimeAction(
  _previous: TimeImportState,
  formData: FormData,
): Promise<TimeImportState> {
  await requireSession();
  const text = read(formData, "text");
  const year = Number(read(formData, "year"));
  const slotMinutes = Number(read(formData, "slotMinutes"));

  if (text.trim() === "") return formIssue("Cole o texto do histórico.");
  if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) {
    return formIssue("O texto passa de 200 KB. Importe em partes.");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return formIssue("Informe o ano das datas, por exemplo 2026.");
  }
  if (!SLOT_SIZES.has(slotMinutes)) return formIssue("Escolha 15, 30 ou 60 minutos.");

  const input: TimeImportInput = {
    text,
    year,
    slotMinutes,
    defaultCategoryId: read(formData, "defaultCategoryId"),
    categoryRules: read(formData, "categoryRules"),
    projectRules: read(formData, "projectRules"),
  };

  if (read(formData, "intent") !== "confirm") {
    const result = await previewTimeImport(input);
    return result.ok ? { preview: result.preview } : { issues: result.issues };
  }

  const result = await importTimeHistory(input);
  if (!result.ok) return { issues: result.issues };
  revalidatePath("/time", "layout");
  revalidatePath("/");
  // The last imported day, where the result is easy to check.
  redirect(`/time?dia=${result.dates.at(-1)}`);
}
