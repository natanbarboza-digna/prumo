import type { Metadata } from "next";
import Link from "next/link";

import { BookFilter } from "@/components/books/book-filter";
import { BookList } from "@/components/books/book-list";
import { DevelopmentTabs } from "@/components/development-tabs";
import { Button } from "@/components/ui/button";
import { todayInAppTimeZone } from "@/lib/dates";
import { bookFilterEmptyText, shelfGroupTitles } from "@/modules/books/labels";
import { groupBooks } from "@/modules/books/rules";
import { bookFilterSchema } from "@/modules/books/schemas";
import { listBooks } from "@/modules/books/service";

export const metadata: Metadata = { title: "Leituras" };

export default async function BooksPage({ searchParams }: PageProps<"/books">) {
  // ?situacao= picks the filter; reading it already makes the page render per
  // request, fresh from the database.
  const filter = bookFilterSchema.parse((await searchParams).situacao);
  const groups = groupBooks(await listBooks(), filter);
  const today = todayInAppTimeZone();

  return (
    <div className="space-y-6">
      <DevelopmentTabs current="/books" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Leituras</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/books/analytics">Ver analíticos</Link>
          </Button>
          <Button asChild>
            <Link href="/books/new">Novo livro</Link>
          </Button>
        </div>
      </div>
      <BookFilter current={filter} />
      {groups.length === 0 && filter !== "SHELF" ? (
        <p className="text-muted-foreground">{bookFilterEmptyText[filter]}</p>
      ) : groups.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Nenhum livro na estante.</p>
          <Button asChild>
            <Link href="/books/new">Cadastrar livro</Link>
          </Button>
        </div>
      ) : (
        groups.map(({ group, books }) => (
          <section key={group} aria-labelledby={`grupo-${group}`} className="space-y-3">
            <h2 id={`grupo-${group}`} className="text-xl font-semibold tracking-tight">
              {shelfGroupTitles[group]} ({books.length})
            </h2>
            <BookList books={books} label={shelfGroupTitles[group]} today={today} />
          </section>
        ))
      )}
    </div>
  );
}
