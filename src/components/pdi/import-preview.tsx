import { type Ref, useId } from "react";

import { formatDateForDisplay } from "@/lib/dates";
import type { ImportPreview as Preview } from "@/modules/pdi/import/service";
import { actionStatusLabels, cycleStatusLabels, importSummaryText } from "@/modules/pdi/labels";

type ImportPreviewProps = {
  preview: Preview;
  /** The heading takes focus when the preview appears, so screen readers start there. */
  headingRef: Ref<HTMLHeadingElement>;
};

/** What the import will create (plan 022). Rendered inside the import form. */
export function ImportPreview({ preview, headingRef }: ImportPreviewProps) {
  const { cycle, areas, checkIns } = preview;
  const actions = areas.reduce((sum, area) => sum + area.actions.length, 0);
  // Next keeps visited pages hidden in the DOM, so ids must be unique per instance.
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-6">
      <div className="space-y-1">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight outline-none"
        >
          Confira antes de importar
        </h2>
        <p role="status">
          {importSummaryText({ areas: areas.length, actions, checkIns: checkIns.length })}
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <h3 className="font-medium break-words">{cycle.title}</h3>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-muted-foreground">Período</dt>
          <dd>
            {formatDateForDisplay(cycle.startDate)} a {formatDateForDisplay(cycle.endDate)}
          </dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{cycleStatusLabels[cycle.status]}</dd>
          {cycle.managerName && (
            <>
              <dt className="text-muted-foreground">Gestor</dt>
              <dd className="break-words">{cycle.managerName}</dd>
            </>
          )}
        </dl>
      </div>

      <ul className="grid gap-4" aria-label="Áreas da planilha">
        {areas.map((area) => (
          <li key={area.name} className="space-y-2 rounded-lg border p-4">
            <h3 className="font-medium break-words">{area.name}</h3>
            {area.actions.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma ação nesta área.</p>
            ) : (
              <ul className="grid gap-2 text-sm" aria-label={`Ações de ${area.name}`}>
                {area.actions.map((action, index) => (
                  <li key={index} className="space-y-0.5">
                    <p className="font-medium break-words">{action.title}</p>
                    <p className="text-muted-foreground">
                      {[
                        action.category.name,
                        actionStatusLabels[action.status],
                        action.dueDate ? `Prazo: ${formatDateForDisplay(action.dueDate)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {checkIns.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Check-ins</h3>
          <ul className="grid gap-1 text-sm" aria-label="Check-ins da planilha">
            {checkIns.map((checkIn, index) => (
              <li key={index} className="break-words">
                <span className="text-muted-foreground">{formatDateForDisplay(checkIn.date)}:</span>{" "}
                {checkIn.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
