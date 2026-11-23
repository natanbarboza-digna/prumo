import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import { NameForm } from "@/components/time/name-form";
import { Badge } from "@/components/ui/badge";
import {
  createTimeCategoryAction,
  deleteTimeCategoryAction,
  setTimeCategoryArchivedAction,
  updateTimeCategoryAction,
} from "@/modules/time/actions";
import { listTimeCategories, timeCategoryIdsInUse } from "@/modules/time/service";

export const metadata: Metadata = { title: "Categorias de tempo" };

/** Time categories (plan 031): create, rename, archive and delete unused ones. */
export default async function TimeCategoriesPage() {
  // No URL data is read here, so make the per-request rendering explicit.
  await connection();
  const [categories, used] = await Promise.all([
    listTimeCategories({ includeArchived: true }),
    timeCategoryIdsInUse(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/time" className="text-muted-foreground text-sm hover:underline">
          ← Tempo
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Categorias de tempo</h1>
        <p className="text-muted-foreground">
          Classificam os blocos de trabalho. Categorias arquivadas não aparecem para registros
          novos; as que já foram usadas só podem ser arquivadas.
        </p>
      </div>

      <section aria-labelledby="titulo-nova-categoria" className="space-y-2 rounded-lg border p-4">
        <h2 id="titulo-nova-categoria" className="font-semibold">
          Nova categoria
        </h2>
        <NameForm
          action={createTimeCategoryAction}
          kind="category"
          label="Nome da nova categoria"
          submitLabel="Criar"
        />
      </section>

      <ul className="grid gap-3" aria-label="Categorias de tempo">
        {categories.map((category) => (
          <li key={category.id} className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium break-words">{category.name}</h2>
              {category.archived && <Badge variant="outline">Arquivada</Badge>}
            </div>
            <NameForm
              action={updateTimeCategoryAction.bind(null, category.id)}
              kind="category"
              label={`Nome da categoria ${category.name}`}
              defaultName={category.name}
              submitLabel="Renomear"
            />
            <div className="flex flex-wrap gap-2">
              <form
                action={setTimeCategoryArchivedAction.bind(null, category.id, !category.archived)}
              >
                <SubmitButton size="sm" variant="outline">
                  {category.archived ? `Desarquivar ${category.name}` : `Arquivar ${category.name}`}
                </SubmitButton>
              </form>
              {!used.has(category.id) && (
                <ConfirmDeleteButton
                  action={deleteTimeCategoryAction.bind(null, category.id)}
                  title="Excluir categoria?"
                  description={`“${category.name}” será excluída. Essa ação não pode ser desfeita.`}
                  triggerLabel={`Excluir ${category.name}`}
                  size="sm"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
