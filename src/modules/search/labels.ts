/** The groups of the search page (plan 027), in screen order. */
export const SEARCH_GROUPS = [
  "GOALS",
  "TRACKS",
  "STEPS",
  "ROUTINES",
  "CYCLES",
  "ACTIONS",
  "BOOKS",
] as const;

export type SearchGroupKey = (typeof SEARCH_GROUPS)[number];

const names: Record<SearchGroupKey, { title: string; one: string; many: string }> = {
  GOALS: { title: "Objetivos", one: "objetivo", many: "objetivos" },
  TRACKS: { title: "Trilhas", one: "trilha", many: "trilhas" },
  STEPS: { title: "Etapas de trilha", one: "etapa", many: "etapas" },
  ROUTINES: { title: "Rotinas", one: "rotina", many: "rotinas" },
  CYCLES: { title: "Ciclos de PDI", one: "ciclo", many: "ciclos" },
  ACTIONS: { title: "Ações de PDI", one: "ação", many: "ações" },
  BOOKS: { title: "Livros", one: "livro", many: "livros" },
};

/** The badge of an item that is put away (archived, ended or in a closed cycle); books say their own. */
export const storedBadge: Record<SearchGroupKey, string> = {
  GOALS: "Arquivado",
  TRACKS: "Arquivada",
  STEPS: "Trilha arquivada",
  ROUTINES: "Encerrada",
  CYCLES: "Encerrado",
  ACTIONS: "Ciclo encerrado",
  BOOKS: "Lido",
};

/** "Trilhas (2)". */
export function groupHeading(group: SearchGroupKey, total: number): string {
  return `${names[group].title} (${total})`;
}

/** "e mais 5 trilhas. Refine a busca para ver." */
export function moreText(group: SearchGroupKey, hidden: number): string {
  const name = hidden === 1 ? names[group].one : names[group].many;
  return `e mais ${hidden} ${name}. Refine a busca para ver.`;
}
