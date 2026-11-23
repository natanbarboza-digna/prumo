import type { Metadata } from "next";
import Link from "next/link";

import { BookStateBadge } from "@/components/books/book-badges";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { formatDateForDisplay, todayInAppTimeZone } from "@/lib/dates";
import { changeBookStatusAction, deleteBookAction } from "@/modules/books/actions";
import { bookActionLabels, bookFormatLabels, bookReasonLabels } from "@/modules/books/labels";
import { bookActions } from "@/modules/books/rules";

import { loadBook } from "./load-book";

export const metadata: Metadata = { title: "Livro" };

const empty = <span className="text-muted-foreground">—</span>;

export default async function BookPage({ params }: PageProps<"/books/[id]">) {
  const book = await loadBook((await params).id);
  const today = todayInAppTimeZone();
  const open = book.status === "TO_READ" || book.status === "READING";
  // "YYYY-MM-DD" strings compare in calendar order.
  const overdue = open && book.dueDate !== null && book.dueDate < today;

  return (
    <article className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <Link href="/books" className="text-muted-foreground text-sm hover:underline">
          ← Leituras
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight break-words">{book.title}</h1>
        <p className="text-muted-foreground break-words">{book.authors}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <BookStateBadge book={book} />
        </div>
      </div>

      {/* One small form per button: each Server Action gets its own status change. */}
      <div className="flex flex-wrap gap-3">
        {bookActions(book.status).map((action, index) => (
          <form key={action} action={changeBookStatusAction.bind(null, book.id, action)}>
            <SubmitButton variant={index === 0 ? "default" : "outline"} pendingContent="Salvando…">
              {bookActionLabels[action]}
            </SubmitButton>
          </form>
        ))}
      </div>

      <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground text-sm">Formato</dt>
        <dd>{bookFormatLabels[book.format]}</dd>
        <dt className="text-muted-foreground text-sm">Páginas</dt>
        <dd>{book.pages ?? empty}</dd>
        <dt className="text-muted-foreground text-sm">Gênero</dt>
        <dd className="break-words">{book.genre ?? empty}</dd>
        <dt className="text-muted-foreground text-sm">Motivo</dt>
        <dd>{bookReasonLabels[book.reason]}</dd>
        {book.dueDate && (
          <>
            <dt className="text-muted-foreground text-sm">Prazo</dt>
            <dd className={overdue ? "text-destructive" : undefined}>
              {formatDateForDisplay(book.dueDate)}
              {overdue && " (vencido)"}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground text-sm">Quem indicou</dt>
        <dd className="break-words">{book.recommendedBy ?? empty}</dd>
        <dt className="text-muted-foreground text-sm">Início</dt>
        <dd>{book.startedOn ? formatDateForDisplay(book.startedOn) : empty}</dd>
        <dt className="text-muted-foreground text-sm">Término</dt>
        <dd>{book.finishedOn ? formatDateForDisplay(book.finishedOn) : empty}</dd>
        <dt className="text-muted-foreground text-sm">Objetivo</dt>
        <dd>
          {book.goal ? (
            <Link href={`/goals/${book.goal.id}`} className="underline underline-offset-4">
              {book.goal.title}
            </Link>
          ) : (
            <span className="text-muted-foreground">Sem objetivo vinculado</span>
          )}
        </dd>
        <dt className="text-muted-foreground text-sm">Notas</dt>
        <dd className="whitespace-pre-line break-words">
          {book.notes ?? <span className="text-muted-foreground">Sem notas.</span>}
        </dd>
      </dl>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/books/${book.id}/edit`}>Editar livro</Link>
        </Button>
        <ConfirmDeleteButton
          action={deleteBookAction.bind(null, book.id)}
          title="Excluir livro?"
          description={`“${book.title}” será excluído. Essa ação não pode ser desfeita.`}
          triggerLabel="Excluir livro"
        />
      </div>
    </article>
  );
}
