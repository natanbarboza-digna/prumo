import { ArrowDown, ArrowUp } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";

type MoveButtonsProps = {
  /** Server Action with the item and direction already bound. */
  moveUp: () => Promise<void>;
  moveDown: () => Promise<void>;
  /** The item's name, for the accessible labels ("Mover para cima: Comunicação"). */
  label: string;
  isFirst: boolean;
  isLast: boolean;
};

/** "Mover para cima" and "Mover para baixo" arrows for a manually ordered list. */
export function MoveButtons({ moveUp, moveDown, label, isFirst, isLast }: MoveButtonsProps) {
  return (
    <>
      <form action={moveUp}>
        <SubmitButton
          size="icon-sm"
          variant="outline"
          disabled={isFirst}
          aria-label={`Mover para cima: ${label}`}
        >
          <ArrowUp aria-hidden="true" />
        </SubmitButton>
      </form>
      <form action={moveDown}>
        <SubmitButton
          size="icon-sm"
          variant="outline"
          disabled={isLast}
          aria-label={`Mover para baixo: ${label}`}
        >
          <ArrowDown aria-hidden="true" />
        </SubmitButton>
      </form>
    </>
  );
}
