import type { Metadata } from "next";

import { BookForm } from "@/components/books/book-form";
import { createBookAction } from "@/modules/books/actions";
import { goalOptions } from "@/modules/goals/options";

export const metadata: Metadata = { title: "Novo livro" };

export default async function NewBookPage() {
  const goals = await goalOptions();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Novo livro</h1>
      <BookForm
        action={createBookAction}
        goals={goals}
        status={null}
        defaultValues={{ title: "", authors: "", format: "PHYSICAL", reason: "PERSONAL" }}
        submitLabel="Cadastrar livro"
        cancelHref="/books"
      />
    </div>
  );
}
