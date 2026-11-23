import Link from "next/link";

import { BookStateBadge } from "@/components/books/book-badges";
import { formatDateForDisplay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { bookDatesText, bookFormatLabels, bookReasonLabels } from "@/modules/books/labels";
import type { Book } from "@/modules/books/service";

type BookListProps = {
  books: Book[];
  /** What the list is, for screen readers ("Lendo", "Livros"). */
  label: string;
  today: string;
  headingLevel?: "h2" | "h3";
  /** Hide the goal line when the list is already shown inside that goal. */
  showGoal?: boolean;
};

/** Books as cards: title, authors, format and reason, then the due date or the dates. */
export function BookList({
  books,
  label,
  today,
  headingLevel = "h3",
  showGoal = true,
}: BookListProps) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-3" aria-label={label}>
      {books.map((book) => {
        const open = book.status === "TO_READ" || book.status === "READING";
        // "YYYY-MM-DD" strings compare in calendar order.
        const overdue = open && book.dueDate !== null && book.dueDate < today;
        const dates = bookDatesText(book);
        return (
          <li key={book.id} className="bg-card space-y-1.5 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Heading className="font-medium break-words">
                <Link href={`/books/${book.id}`} className="hover:underline">
                  {book.title}
                </Link>
              </Heading>
              <BookStateBadge book={book} />
            </div>
            <p className="text-muted-foreground text-sm break-words">{book.authors}</p>
            <p className="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
              <span>{bookFormatLabels[book.format]}</span>
              <span>{bookReasonLabels[book.reason]}</span>
              {open && book.dueDate && (
                <span className={cn(overdue && "text-destructive")}>
                  {overdue ? "Prazo vencido em" : "Prazo:"} {formatDateForDisplay(book.dueDate)}
                </span>
              )}
              {dates && <span>{dates}</span>}
              {showGoal && book.goal && (
                <span>
                  Objetivo:{" "}
                  <Link
                    href={`/goals/${book.goal.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {book.goal.title}
                  </Link>
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
