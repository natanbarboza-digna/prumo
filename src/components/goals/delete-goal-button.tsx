"use client";
// Client Component: the confirmation dialog has open/closed state in the browser.

import { useLayoutEffect, useState } from "react";
import { useFormStatus } from "react-dom";

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
import { deleteGoalAction } from "@/modules/goals/actions";

export function DeleteGoalButton({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  // bind() fixes the first argument, producing an action that takes no input
  // from the form; the server still re-checks the id.
  const deleteAction = deleteGoalAction.bind(null, goalId);
  const [open, setOpen] = useState(false);

  // Next keeps this page in the DOM (hidden) after navigating away; close the
  // dialog when that happens so it is not still open on the way back.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Excluir</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir objetivo?</AlertDialogTitle>
          <AlertDialogDescription>
            “{goalTitle}” será excluído. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={deleteAction}>
            <ConfirmDeleteButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmDeleteButton() {
  // useFormStatus reads the pending state of the <form> this button is inside.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Excluindo…" : "Excluir"}
    </Button>
  );
}
