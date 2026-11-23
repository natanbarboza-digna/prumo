import type { Metadata } from "next";

import { BookForm } from "@/components/books/book-form";
import { updateBookAction } from "@/modules/books/actions";
import { positionInputValue } from "@/modules/books/labels";
import { goalOptions } from "@/modules/goals/options";

import { loadBook } from "../load-book";

export const metadata: Metadata = { title: "Editar livro" };

export default async function EditBookPage({ params }: PageProps<"/books/[id]/edit">) {
  const book = await loadBook((await params).id);
  const goals = await goalOptions(book.goal);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Editar livro</h1>
      <BookForm
        action={updateBookAction.bind(null, book.id)}
        goals={goals}
        status={book.status}
        defaultValues={{
          title: book.title,
          authors: book.authors,
          format: book.format,
          pages: book.pages === null ? "" : String(book.pages),
          genre: book.genre ?? "",
          recommendedBy: book.recommendedBy ?? "",
          notes: book.notes ?? "",
          reason: book.reason,
          dueDate: book.dueDate ?? "",
          goalId: book.goal?.id ?? "",
          startedOn: book.startedOn ?? "",
          finishedOn: book.finishedOn ?? "",
          durationMinutes:
            book.durationMinutes === null ? "" : positionInputValue("MINUTE", book.durationMinutes),
        }}
        submitLabel="Salvar alterações"
        cancelHref={`/books/${book.id}`}
      />
    </div>
  );
}
