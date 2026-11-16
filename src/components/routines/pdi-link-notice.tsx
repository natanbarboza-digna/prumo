import Link from "next/link";

type PdiLinkNoticeProps = {
  action: { id: string; title: string; cycleId: string };
  cycleTitle?: string;
};

/** Shown on the routine form when the routine is (or will be) linked to a PDI action. */
export function PdiLinkNotice({ action, cycleTitle }: PdiLinkNoticeProps) {
  return (
    <p role="note" className="bg-muted rounded-md p-3 text-sm">
      Vinculada à ação de PDI{" "}
      <Link
        href={`/pdi/${action.cycleId}/actions/${action.id}`}
        className="font-medium underline underline-offset-4"
      >
        {action.title}
      </Link>
      {cycleTitle && ` (${cycleTitle})`}. Os registros desta rotina contam como evidência da ação.
    </p>
  );
}
