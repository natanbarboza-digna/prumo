import { describe, expect, it } from "vitest";

import { matchRule, parseRules } from "@/modules/time/import/rules";

describe("parseRules (plan 033)", () => {
  it("reads one 'word = Name' per line, ignoring blank lines", () => {
    expect(parseRules("chamado = Chamados\n\n  Configuração=Projeto  \n")).toEqual({
      rules: [
        { word: "chamado", name: "Chamados", line: 1 },
        { word: "configuracao", name: "Projeto", line: 3 },
      ],
      issues: [],
    });
  });

  it("reports lines without a word or a name, with their number", () => {
    expect(parseRules("chamado Chamados\n = Projeto\natend =").issues).toEqual([
      { line: 1, message: 'Use "palavra = Nome".' },
      { line: 2, message: 'Use "palavra = Nome".' },
      { line: 3, message: 'Use "palavra = Nome".' },
    ]);
  });

  it("splits only on the first '=' so names may contain one", () => {
    expect(parseRules("a = B = C").rules).toEqual([{ word: "a", name: "B = C", line: 1 }]);
  });
});

describe("matchRule", () => {
  const { rules } = parseRules("chamado = Chamados\natend = Atendimento\nconfiguração = Projeto");

  it("picks the first rule whose word the text contains, regardless of case and accents", () => {
    expect(matchRule(rules, "Atendi ao CHAMADO de pasta segura")).toBe("Chamados");
    expect(matchRule(rules, "atendimento de Kaydson")).toBe("Atendimento");
    expect(matchRule(rules, "configuracao digna relatórios")).toBe("Projeto");
  });

  it("gives null when no rule matches", () => {
    expect(matchRule(rules, "almoço")).toBeNull();
    expect(matchRule([], "qualquer")).toBeNull();
  });
});
