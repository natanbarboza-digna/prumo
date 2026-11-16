"use client";
// Client Component: the confirmation dialog has open/closed state in the browser.

import { useLayoutEffect, useState } from "react";

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

type EndRoutineButtonProps = {
  /** endRoutineAction with the routine id already bound. */
  action: () => Promise<void>;
  routineTitle: string;
};

export function EndRoutineButton({ action, routineTitle }: EndRoutineButtonProps) {
  const [open, setOpen] = useState(false);

  // Close the dialog when Next hides this page after navigating away.
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Encerrar rotina</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Encerrar rotina?</AlertDialogTitle>
          <AlertDialogDescription>
            “{routineTitle}” termina hoje: a partir de amanhã deixa de aparecer em Hoje e vai para
            as rotinas encerradas. O histórico é mantido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <form action={action}>
            <SubmitButton pendingContent="Encerrando…" className="w-full sm:w-auto">
              Encerrar
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
