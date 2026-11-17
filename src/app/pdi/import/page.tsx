import type { Metadata } from "next";

import { ImportForm } from "@/components/pdi/import-form";

export const metadata: Metadata = { title: "Importar PDI" };

export default function ImportPdiPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Importar PDI</h1>
        <p className="text-muted-foreground">
          Cria um ciclo novo, com áreas, ações e check-ins, a partir da planilha modelo.
        </p>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          <a
            href="/templates/modelo-pdi.xlsx"
            download
            className="font-medium underline underline-offset-4"
          >
            Baixar planilha modelo
          </a>{" "}
          e copiar para ela os dados do PDI da empresa. A aba Instruções explica cada coluna.
        </li>
        <li>Salvar como .xlsx (no Excel ou no Google Sheets) e enviar abaixo.</li>
        <li>Se algo estiver errado, nada é importado e a lista mostra a aba, a linha e o campo.</li>
      </ol>

      <ImportForm />
    </div>
  );
}
