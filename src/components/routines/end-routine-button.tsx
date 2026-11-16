import { ConfirmActionButton } from "@/components/confirm-action-button";

type EndRoutineButtonProps = {
  /** endRoutineAction with the routine id already bound. */
  action: () => Promise<void>;
  routineTitle: string;
};

export function EndRoutineButton({ action, routineTitle }: EndRoutineButtonProps) {
  return (
    <ConfirmActionButton
      action={action}
      triggerLabel="Encerrar rotina"
      title="Encerrar rotina?"
      description={`“${routineTitle}” termina hoje: a partir de amanhã deixa de aparecer em Hoje e vai para as rotinas encerradas. O histórico é mantido.`}
      confirmLabel="Encerrar"
      pendingLabel="Encerrando…"
    />
  );
}
