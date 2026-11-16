"use client";
// Client Component: the confirmation dialog has open/closed state in the browser.

import { type ComponentProps, useLayoutEffect, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmDeleteButtonProps = {
  /** A Server Action with its arguments already bound (e.g. `deleteX.bind(null, id)`). */
  action: () => Promise<void>;
  title: string;
  description: string;
  /** Accessible name of the trigger when the visible "Excluir" is not specific enough. */
  triggerLabel?: string;
  size?: ComponentProps<typeof Button>["size"];
};

export function ConfirmDeleteButton({
  action,
  title,
  description,
  triggerLabel,
  size,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);

  // Next keeps this page in the DOM (hidden) after navigating away; close the
  // dialog when that happens so it is not still open on the way back.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size={size} aria-label={triggerLabel}>
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={action}>
            <SubmitButton
              variant="destructive"
              pendingContent="Excluindo…"
              className="w-full sm:w-auto"
            >
              Excluir
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
