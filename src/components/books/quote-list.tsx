import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { deleteQuoteAction } from "@/modules/books/actions";
import type { BookQuote } from "@/modules/books/service";

/** The book's quotes, newest first (plan 036), each with "Editar" and "Excluir". */
export function QuoteList({ bookId, quotes }: { bookId: string; quotes: BookQuote[] }) {
  if (quotes.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhum trecho marcado ainda.</p>;
  }
  return (
    <ul className="grid gap-3" aria-label="Trechos">
      {quotes.map((quote, index) => {
        // The first words name the buttons, since every quote has the same two.
        const name = quote.text.length > 40 ? `${quote.text.slice(0, 40)}…` : quote.text;
        return (
          <li key={quote.id} className="bg-card space-y-2 rounded-lg border p-4">
            <blockquote className="border-l-2 pl-3 whitespace-pre-line break-words italic">
              {quote.text}
            </blockquote>
            <div className="flex flex-wrap items-center gap-2">
              {quote.location && (
                <span className="text-muted-foreground text-sm">{quote.location}</span>
              )}
              <span className="ml-auto flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/books/${bookId}/quotes/${quote.id}/edit`}
                    aria-label={`Editar trecho ${index + 1}: ${name}`}
                  >
                    Editar
                  </Link>
                </Button>
                <ConfirmDeleteButton
                  action={deleteQuoteAction.bind(null, quote.id)}
                  title="Excluir trecho?"
                  description="O trecho será excluído. Essa ação não pode ser desfeita."
                  triggerLabel={`Excluir trecho ${index + 1}: ${name}`}
                  size="sm"
                />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
