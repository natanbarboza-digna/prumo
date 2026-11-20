import { z } from "zod";

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/**
 * `?q=` from the URL (plan 027): trimmed, 2 to 100 characters. Anything else
 * (missing, repeated, too short or too long) is null: show the form, no search.
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .min(SEARCH_MIN_LENGTH)
  .max(SEARCH_MAX_LENGTH)
  .nullable()
  .catch(null)
  .transform((value) => value ?? null);

/** The escape character for LIKE patterns; the SQL says `ESCAPE '!'`. */
export const LIKE_ESCAPE = "!";

/** "50%" → "%50!%%": the term matches anywhere, and its own % and _ are plain text. */
export function likePattern(term: string): string {
  const escaped = term.replace(/[!%_]/g, (char) => `${LIKE_ESCAPE}${char}`);
  return `%${escaped}%`;
}
