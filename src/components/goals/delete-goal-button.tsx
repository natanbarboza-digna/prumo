import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { deleteGoalAction } from "@/modules/goals/actions";

export function DeleteGoalButton({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  return (
    <ConfirmDeleteButton
      // bind() fixes the id, producing an action that takes no form input;
      // the server still re-checks it.
      action={deleteGoalAction.bind(null, goalId)}
      title="Excluir objetivo?"
      description={`“${goalTitle}” será excluído. As trilhas vinculadas continuarão existindo, sem vínculo. Essa ação não pode ser desfeita.`}
    />
  );
}
