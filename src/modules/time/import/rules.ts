// "word = Name" rules of the time import (plan 033): which category or project
// a line of the history gets. Pure, so it is tested alone.

import { normalizeActivity } from "@/modules/time/analytics";

/** `line`: where the rule was typed, for the messages about it. */
export type WordRule = { word: string; name: string; line: number };

export type RuleIssue = { line: number; message: string };

/** One rule per line; blank lines are ignored. Words are normalized like activities. */
export function parseRules(text: string): { rules: WordRule[]; issues: RuleIssue[] } {
  const rules: WordRule[] = [];
  const issues: RuleIssue[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    if (raw.trim() === "") return;
    // Only the first "=" splits, so a name may contain one.
    const at = raw.indexOf("=");
    const word = at === -1 ? "" : normalizeActivity(raw.slice(0, at));
    const name = at === -1 ? "" : raw.slice(at + 1).trim();
    if (word === "" || name === "") {
      issues.push({ line: index + 1, message: 'Use "palavra = Nome".' });
      return;
    }
    rules.push({ word, name, line: index + 1 });
  });
  return { rules, issues };
}

/** The name of the first rule whose word the text contains, or null. */
export function matchRule(rules: readonly WordRule[], text: string): string | null {
  const normalized = normalizeActivity(text);
  return rules.find((rule) => normalized.includes(rule.word))?.name ?? null;
}
