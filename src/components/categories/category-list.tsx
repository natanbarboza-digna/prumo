import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteCategoryAction, setCategoryArchivedAction } from "@/modules/categories/actions";
import type { ActionCategory } from "@/modules/categories/service";

function actionCountText(count: number): string {
  if (count === 0) return "Nenhuma ação";
  return `${count} ${count === 1 ? "ação" : "ações"}`;
}

// Server Component: each button is a small <form> bound to a Server Action.
export function CategoryList({ categories }: { categories: ActionCategory[] }) {
  return (
    <ul className="grid gap-3" aria-label="Categorias">
      {categories.map((category) => (
        <li
          key={category.id}
          className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        >
          <div className="space-y-1">
            <h2 className="flex flex-wrap items-center gap-2 font-medium break-words">
              {category.name}
              {category.archived && <Badge variant="secondary">Arquivada</Badge>}
            </h2>
            <p className="text-muted-foreground text-sm">
              Permite rotina: {category.allowsRoutine ? "sim" : "não"} ·{" "}
              {actionCountText(category.actionCount)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/settings/categories/${category.id}/edit`}
                aria-label={`Editar: ${category.name}`}
              >
                Editar
              </Link>
            </Button>
            <form action={setCategoryArchivedAction.bind(null, category.id, !category.archived)}>
              <SubmitButton
                size="sm"
                variant="outline"
                aria-label={`${category.archived ? "Desarquivar" : "Arquivar"}: ${category.name}`}
              >
                {category.archived ? "Desarquivar" : "Arquivar"}
              </SubmitButton>
            </form>
            {category.actionCount === 0 ? (
              <ConfirmDeleteButton
                action={deleteCategoryAction.bind(null, category.id)}
                title="Excluir categoria?"
                description={`“${category.name}” será excluída. Essa ação não pode ser desfeita.`}
                triggerLabel={`Excluir: ${category.name}`}
                size="sm"
              />
            ) : (
              <span className="text-muted-foreground text-xs">Em uso: só pode ser arquivada.</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
