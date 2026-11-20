import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEARCH_MAX_LENGTH } from "@/modules/search/schemas";

/**
 * A plain GET form (plan 027): the term goes to the URL as ?q=, so the browser
 * handles it without JavaScript and the result can be reloaded or bookmarked.
 * A Server Component; useId still works here and keeps ids unique when Next
 * keeps a visited copy of the page hidden in the DOM.
 */
export function SearchForm({ term }: { term: string }) {
  const inputId = useId();
  const hintId = useId();

  return (
    <form action="/search" method="get" role="search" className="space-y-2">
      <Label htmlFor={inputId}>Buscar</Label>
      <div className="flex flex-wrap gap-3">
        {/* The key resets the field when another search opens this same page. */}
        <Input
          key={term}
          id={inputId}
          name="q"
          type="search"
          defaultValue={term}
          maxLength={SEARCH_MAX_LENGTH}
          aria-describedby={hintId}
          className="min-w-0 flex-1"
        />
        <Button type="submit">Buscar</Button>
      </div>
      <p id={hintId} className="text-muted-foreground text-sm">
        Procura em objetivos, trilhas e etapas, rotinas e no PDI, sem diferenciar maiúsculas nem
        acentos.
      </p>
    </form>
  );
}
