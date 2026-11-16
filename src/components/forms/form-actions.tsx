import Link from "next/link";

import { Button } from "@/components/ui/button";

type FormActionsProps = {
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
};

/** Submit + cancel row shared by every form. */
export function FormActions({ pending, submitLabel, cancelHref }: FormActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </Button>
      <Button asChild variant="outline">
        <Link href={cancelHref}>Cancelar</Link>
      </Button>
    </div>
  );
}

export function FormErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}
