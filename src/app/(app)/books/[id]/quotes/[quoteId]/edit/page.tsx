import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuoteForm } from "@/components/books/quote-form";
import { updateQuoteAction } from "@/modules/books/actions";

import { loadBook } from "../../../load-book";

export const metadata: Metadata = { title: "Editar trecho" };

export default async function EditQuotePage({
  params,
}: PageProps<"/books/[id]/quotes/[quoteId]/edit">) {
  const { id, quoteId } = await params;
  const book = await loadBook(id);
  const quote = book.quotes.find((item) => item.id === quoteId);
  if (!quote) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Editar trecho</h1>
        <p className="text-muted-foreground break-words">{book.title}</p>
      </div>
      <QuoteForm
        action={updateQuoteAction.bind(null, quote.id, book.id)}
        defaultValues={{ text: quote.text, location: quote.location ?? "" }}
        cancelHref={`/books/${book.id}#trechos`}
      />
    </div>
  );
}
