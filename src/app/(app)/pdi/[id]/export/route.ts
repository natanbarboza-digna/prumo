// "Baixar planilha" on the cycle page (plan 022). A Route Handler, not a Server
// Action: a download needs a URL that answers with a file, so the button is a
// plain link that works even without JavaScript.

import { requireSession } from "@/modules/auth/session";
import { exportCycle } from "@/modules/pdi/export/service";
import { PdiCycleNotFoundError } from "@/modules/pdi/service";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(_request: Request, context: RouteContext<"/pdi/[id]/export">) {
  // The proxy only checks that a session cookie exists; this checks the session.
  await requireSession();
  const { id } = await context.params;

  try {
    const { file, fileName } = await exportCycle(id);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": XLSX,
        // exportFileName keeps only a-z, 0-9 and hyphens, so no quoting issues.
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PdiCycleNotFoundError) {
      return new Response("Ciclo não encontrado.", { status: 404 });
    }
    throw error;
  }
}
