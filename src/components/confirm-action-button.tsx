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

type ConfirmActionButtonProps = {
  /** A Server Action with its arguments already bound (e.g. `closeX.bind(null, id)`). */
  action: () => Promise<void>;
  /** Visible text of the button that opens the dialog. */
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  variant?: ComponentProps<typeof Button>["variant"];
};

/** A button that asks for confirmation before running a non-destructive action. */
export function ConfirmActionButton({
  action,
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingLabel,
  variant = "outline",
}: ConfirmActionButtonProps) {
  const [open, setOpen] = useState(false);

  // Close the dialog when Next hides this page after navigating away.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant}>{triggerLabel}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={action}>
            <SubmitButton pendingContent={pendingLabel} className="w-full sm:w-auto">
              {confirmLabel}
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
