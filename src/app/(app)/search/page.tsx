import type { Metadata } from "next";
import { connection } from "next/server";

import { SearchForm } from "@/components/search/search-form";
import { SearchResults } from "@/components/search/search-results";
import { todayInAppTimeZone } from "@/lib/dates";
import { SEARCH_MIN_LENGTH, searchQuerySchema } from "@/modules/search/schemas";
import { search } from "@/modules/search/service";

/** "Busca: inglês · Prumo" in the browser tab once there is a term. */
export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const term = searchQuerySchema.parse((await searchParams).q);
  return { title: term ? `Busca: ${term}` : "Busca" };
}

/** The single search (plan 027). ?q= is read under this route's loading.tsx. */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const typed = typeof raw === "string" ? raw.trim() : "";
  const term = searchQuerySchema.parse(raw);
  // "Today" (for ended routines) is read before any database access, so tell
  // Next this page renders per request instead of prerendering a frozen clock.
  await connection();
  const results = term ? await search(term, todayInAppTimeZone()) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Busca</h1>
      <SearchForm term={typed} />
      {results && term ? (
        <SearchResults term={term} results={results} />
      ) : (
        typed !== "" && (
          <p role="status">Digite pelo menos {SEARCH_MIN_LENGTH} caracteres para buscar.</p>
        )
      )}
    </div>
  );
}
