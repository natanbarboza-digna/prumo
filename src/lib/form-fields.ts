// Zod building blocks shared by the domain schemas. Form fields always arrive
// as strings, so optional fields turn "" (after trimming) into null.
import { z } from "zod";

import { isValidDateOnly } from "@/lib/dates";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tooLong = (max: number) => `Use no máximo ${max} caracteres.`;

/** Required text, trimmed, between 1 and `max` characters. */
export function requiredText(max: number, emptyMessage = "Informe um título.") {
  return z.string().trim().min(1, emptyMessage).max(max, tooLong(max));
}

/** Optional text, trimmed; blank becomes null. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, tooLong(max))
    .optional()
    .transform((value) => (value ? value : null));
}

/** Optional calendar date as "YYYY-MM-DD"; blank becomes null. */
export function optionalDateOnly() {
  return optionalText(10).refine((value) => value === null || isValidDateOnly(value), {
    error: "Informe uma data válida.",
  });
}

/** Required calendar date as "YYYY-MM-DD". */
export function requiredDateOnly(emptyMessage = "Informe uma data.") {
  return (
    z
      .string({ error: emptyMessage })
      .trim()
      // abort: an empty value gets only the "missing" message, not "invalid" too.
      .min(1, { error: emptyMessage, abort: true })
      .refine(isValidDateOnly, { error: "Informe uma data válida." })
  );
}

/** Required reference to another record by UUID (a select with no choice sends ""). */
export function requiredUuid(message: string) {
  return z
    .string({ error: message })
    .trim()
    .refine((value) => UUID_PATTERN.test(value), { error: message });
}

/** Optional reference to another record by UUID; blank becomes null. */
export function optionalUuid(message: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || UUID_PATTERN.test(value), { error: message });
}

/** Optional http(s) link; blank becomes null. Other schemes (javascript:, ftp:) are rejected. */
export function optionalHttpUrl(max: number) {
  return optionalText(max).refine((value) => value === null || isHttpUrl(value), {
    error: "Informe um link começando com http:// ou https://.",
  });
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
