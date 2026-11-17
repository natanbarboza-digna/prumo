"use server";
// Server Action for the spreadsheet upload: the form sends the file inside its
// FormData, so no Route Handler is needed. The file is untrusted input: size
// and type are checked here, and the content by the service.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/modules/auth/session";
import type { ImportIssue } from "@/modules/pdi/import/sheets";
import { importPdi } from "@/modules/pdi/import/service";

export type ImportFormState = {
  /** A problem with the file field itself (missing, too large, wrong type). */
  fileError?: string;
  /** Problems inside the spreadsheet: nothing was imported. */
  issues?: ImportIssue[];
};

// A "use server" file may only export async functions, so this stays private.
const MAX_IMPORT_BYTES = 1024 * 1024;

export async function importPdiAction(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fileError: "Escolha a planilha (.xlsx) para importar." };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return { fileError: "A planilha passa de 1 MB. Confira se é a planilha certa." };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { fileError: "Envie um arquivo .xlsx (a planilha modelo salva no Excel ou no Sheets)." };
  }

  const result = await importPdi(Buffer.from(await file.arrayBuffer()));
  if (!result.ok) return { issues: result.issues };

  revalidatePath("/pdi", "layout");
  revalidatePath("/");
  redirect(`/pdi/${result.cycleId}`);
}
