import Link from "next/link";
import { useId } from "react";

import { SubmitButton } from "@/components/submit-button";
import { EntryForm } from "@/components/time/entry-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimeOfDay } from "@/lib/time-of-day";
import {
  clearSlotAction,
  joinSlotAction,
  pauseAction,
  repeatPreviousAction,
  saveEntryAction,
  splitSlotAction,
} from "@/modules/time/actions";
import { slotLabel } from "@/modules/time/labels";
import { type PlacedSlot, type Slot, canSplit } from "@/modules/time/rules";
import type { Half, TimeEntryView } from "@/modules/time/service";

type DayGridProps = {
  date: string;
  slots: PlacedSlot<TimeEntryView>[];
  /** Start of an empty block shown in halves (?dividir=HH:MM), before anything is saved. */
  splitting: string | null;
  categories: { id: string; name: string }[];
  descriptions: string[];
  projects: string[];
};

/**
 * The day's blocks, each with its form and buttons (plan 031). A Server
 * Component: every small button is a <form> with a bound Server Action, so
 * it works before JavaScript loads; only the text form is a Client Component.
 */
export function DayGrid({
  date,
  slots,
  splitting,
  categories,
  descriptions,
  projects,
}: DayGridProps) {
  const descriptionListId = useId();
  const projectListId = useId();

  return (
    <>
      <datalist id={descriptionListId}>
        {descriptions.map((text) => (
          <option key={text} value={text} />
        ))}
      </datalist>
      <datalist id={projectListId}>
        {projects.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <ol className="grid gap-3" aria-label="Blocos do dia">
        {slots.map((placed) => {
          const start = formatTimeOfDay(placed.slot.start);
          const split = placed.split || splitting === start;
          const label = slotLabel(placed.slot);
          return (
            <li key={start} className="bg-card space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium tabular-nums">{label}</h3>
                <div className="flex flex-wrap gap-2">
                  {split ? (
                    <form action={joinSlotAction.bind(null, date, start)}>
                      <SubmitButton size="sm" variant="ghost" aria-label={`Juntar ${label}`}>
                        Juntar
                      </SubmitButton>
                    </form>
                  ) : (
                    canSplit(placed.slot) &&
                    (placed.entries.length === 0 ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/time?dia=${date}&dividir=${start}`}
                          aria-label={`Dividir ${label}`}
                          scroll={false}
                        >
                          Dividir
                        </Link>
                      </Button>
                    ) : (
                      <form action={splitSlotAction.bind(null, date, start)}>
                        <SubmitButton size="sm" variant="ghost" aria-label={`Dividir ${label}`}>
                          Dividir
                        </SubmitButton>
                      </form>
                    ))
                  )}
                </div>
              </div>
              {split ? (
                <div className="grid gap-3 border-l-2 pl-3">
                  {(["FIRST", "SECOND"] as const).map((half) => (
                    <Part
                      key={half}
                      date={date}
                      slot={placed.slot}
                      start={start}
                      half={half}
                      entry={halfEntry(placed, half)}
                      categories={categories}
                      descriptionListId={descriptionListId}
                      projectListId={projectListId}
                    />
                  ))}
                </div>
              ) : (
                <Part
                  date={date}
                  slot={placed.slot}
                  start={start}
                  half={null}
                  entry={placed.entries[0] ?? null}
                  categories={categories}
                  descriptionListId={descriptionListId}
                  projectListId={projectListId}
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function halfEntry(placed: PlacedSlot<TimeEntryView>, half: Half): TimeEntryView | null {
  const middle = placed.slot.start + (placed.slot.end - placed.slot.start) / 2;
  const startMinute = half === "FIRST" ? placed.slot.start : middle;
  return placed.entries.find((entry) => entry.startMinute === startMinute) ?? null;
}

type PartProps = {
  date: string;
  slot: Slot;
  start: string;
  half: Half | null;
  entry: TimeEntryView | null;
  categories: { id: string; name: string }[];
  descriptionListId: string;
  projectListId: string;
};

/** A whole block or one half: the form (or the break) and its buttons. */
function Part({
  date,
  slot,
  start,
  half,
  entry,
  categories,
  descriptionListId,
  projectListId,
}: PartProps) {
  const middle = slot.start + (slot.end - slot.start) / 2;
  const label =
    half === null
      ? slotLabel(slot)
      : half === "FIRST"
        ? slotLabel({ start: slot.start, end: middle })
        : slotLabel({ start: middle, end: slot.end });
  // A category archived after the entry was made still shows as its choice.
  const options =
    entry?.category && !categories.some((category) => category.id === entry.category?.id)
      ? [...categories, entry.category]
      : categories;

  return (
    <div className="space-y-2">
      {half !== null && <p className="text-muted-foreground text-sm tabular-nums">{label}</p>}
      {entry?.kind === "BREAK" ? (
        <p className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">Pausa</Badge>
          {entry.description}
        </p>
      ) : (
        <EntryForm
          // Remount when the saved content changes (e.g. "Repetir o anterior").
          key={`${entry?.description}|${entry?.category?.id}|${entry?.project?.name}`}
          action={saveEntryAction.bind(null, date, start, half)}
          blockLabel={label}
          defaultValues={{
            description: entry?.description ?? "",
            categoryId: entry?.category?.id ?? "",
            projectName: entry?.project?.name ?? "",
          }}
          categories={options}
          descriptionListId={descriptionListId}
          projectListId={projectListId}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <form action={repeatPreviousAction.bind(null, date, start, half)}>
          <SubmitButton size="sm" variant="outline" aria-label={`Repetir o anterior em ${label}`}>
            Repetir o anterior
          </SubmitButton>
        </form>
        {entry?.kind !== "BREAK" && (
          <form action={pauseAction.bind(null, date, start, half)}>
            <SubmitButton size="sm" variant="outline" aria-label={`Pausa em ${label}`}>
              Pausa
            </SubmitButton>
          </form>
        )}
        {entry && (
          <form action={clearSlotAction.bind(null, date, start, half)}>
            <SubmitButton size="sm" variant="ghost" aria-label={`Limpar ${label}`}>
              Limpar
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
