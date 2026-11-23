import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { TimeImportForm } from "@/components/time/import/time-import-form";
import { todayInAppTimeZone } from "@/lib/dates";
import { listTimeCategories } from "@/modules/time/service";

export const metadata: Metadata = { title: "Importar histórico de tempo" };

/** Pasting the .md history (plan 033). */
export default async function TimeImportPage() {
  // "Today" gives the default year; no URL data is read here.
  await connection();
  const categories = await listTimeCategories();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/time" className="text-muted-foreground text-sm hover:underline">
          ← Tempo
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Importar histórico</h1>
        <p className="text-muted-foreground">
          Cole o texto no formato do <code>.md</code>: uma linha com a data (<code>**16/11**</code>)
          e, abaixo, uma linha por horário (<code>08:30 - o que foi feito</code>
          ). &quot;Cheguei&quot; na primeira linha e &quot;fim do expediente&quot; na última marcam
          a entrada e a saída; &quot;almoço&quot;, &quot;pausa&quot;, &quot;intervalo&quot; e
          &quot;café&quot; viram pausa. Nada é gravado antes da confirmação, e um problema em
          qualquer linha impede a importação inteira.
        </p>
      </div>
      <TimeImportForm
        categories={categories}
        defaultYear={Number(todayInAppTimeZone().slice(0, 4))}
      />
    </div>
  );
}
