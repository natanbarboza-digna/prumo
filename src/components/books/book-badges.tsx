import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import type { BookReason, BookStatus } from "@/generated/prisma/enums";
import { bookStateLabel } from "@/modules/books/labels";
import { type ShelfGroup, shelfGroupOf } from "@/modules/books/rules";

type Variant = ComponentProps<typeof Badge>["variant"];

// Green only for a finished book: the one color besides overdue red.
const variants: Record<ShelfGroup, Variant> = {
  READING: "default",
  REQUIRED: "secondary",
  WANTED: "outline",
  READ: "success",
  ABANDONED: "outline",
};

/** "Lendo", "Preciso ler", "Quero ler", "Lido" or "Abandonado". */
export function BookStateBadge({ book }: { book: { status: BookStatus; reason: BookReason } }) {
  return <Badge variant={variants[shelfGroupOf(book)]}>{bookStateLabel(book)}</Badge>;
}
