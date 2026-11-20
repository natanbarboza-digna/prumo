/** "PDI 2026/1" → "pdi-pdi-2026-1.xlsx": no accents, spaces or symbols in the download. */
export function exportFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `pdi-${slug}.xlsx` : "pdi.xlsx";
}
