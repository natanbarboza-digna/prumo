import { describe, expect, it } from "vitest";

import { type ParseOptions, parseTimeHistory } from "@/modules/time/import/parse";
import { parseRules } from "@/modules/time/import/rules";

const hm = (h: number, m = 0) => h * 60 + m;

const EXAMPLE = `**16/11**
08:15 - cheguei
08:30 - olhei a caixa de e-mail, chamados
09:00 - atendi ao chamado de pasta segura
09:30 - recebimento do cancelamento da bluepex, auxílio com a thinkdigital
10:00 - atendimento de kaydson Gustavo
10:30 - configuração digna relatórios
11:00 - configuração digna relatórios
11:30 - configuração digna relatórios
12:00 - configuração digna relatórios
12:30 - almoço
13:30 - resolvendo usuário da máxima (caruaru), removendo processo do Protheus
14:00 - configuração do ad para o digna relatórios, atendimento demanda Hanna e eugênio
14:30 - atendimento demanda Hanna e Eugênio
15:00 - configuração do ad para o digna relatórios
15:30 - configuração do ad para o digna relatórios
16:00 - configuração do ad para o digna relatórios
16:30 - configuração do ad para o digna relatórios
17:00 - configuração do ad para o digna relatórios
17:30 - configuração do ad para o digna relatórios
18:00 - validação dos chamados
18:30 - fim do expediente`;

function options(overrides: Partial<ParseOptions> = {}): ParseOptions {
  return {
    year: 2026,
    slotMinutes: 30,
    today: "2026-11-23",
    defaultCategory: "Chamados",
    categoryRules: parseRules("chamado = Chamados\natend = Atendimento\nconfiguração = Projeto")
      .rules,
    projectRules: parseRules("digna = Digna\nmáxima = Máxima").rules,
    ...overrides,
  };
}

const at = (minute: number) => (entry: { startMinute: number }) => entry.startMinute === minute;

describe("parseTimeHistory (plan 033)", () => {
  it("reads the whole 16/11 example into one day with its markers, breaks and rules", () => {
    const { days, issues } = parseTimeHistory(EXAMPLE, options());

    expect(issues).toEqual([]);
    expect(days).toHaveLength(1);
    const day = days[0]!;
    expect(day).toMatchObject({
      date: "2026-11-16",
      startMinute: hm(8, 15),
      endMinute: hm(18, 30),
    });
    // "cheguei" leaves 08:15–08:30 empty; "fim do expediente" is the end.
    expect(day.entries).toHaveLength(20);
    expect(day.entries[0]).toMatchObject({
      startMinute: hm(8, 30),
      minutes: 30,
      kind: "WORK",
      description: "olhei a caixa de e-mail, chamados",
      categoryName: "Chamados",
      projectName: null,
    });
    // Lunch from 12:30 to 13:30: one break per 30-minute block.
    expect(day.entries.filter((entry) => entry.kind === "BREAK")).toEqual([
      expect.objectContaining({
        startMinute: hm(12, 30),
        minutes: 30,
        description: "almoço",
        categoryName: null,
      }),
      expect.objectContaining({ startMinute: hm(13), minutes: 30, description: "almoço" }),
    ]);
    expect(day.entries.find(at(hm(13, 30)))).toMatchObject({
      categoryName: "Chamados",
      projectName: "Máxima",
    });
    // The first matching rule wins: "chamado" is not there, "atend" is.
    expect(day.entries.find(at(hm(14)))).toMatchObject({
      categoryName: "Atendimento",
      projectName: "Digna",
    });
    expect(day.entries.find(at(hm(10, 30)))).toMatchObject({ categoryName: "Projeto" });
    expect(day.entries.find(at(hm(18)))).toMatchObject({ categoryName: "Chamados", line: 21 });
  });

  it("accepts dates without bold and other separators", () => {
    const text = "17/11\n09:00 – reunião de alinhamento\n09:30: e-mail\n10:00 - fim";

    const { days, issues } = parseTimeHistory(text, options());

    expect(issues).toEqual([]);
    expect(days[0]?.entries.map((entry) => entry.description)).toEqual([
      "reunião de alinhamento",
      "e-mail",
    ]);
  });

  it("uses the first line as the start when it is work, and ends a block after the last line", () => {
    const { days } = parseTimeHistory("**18/11**\n09:00 - e-mail\n09:30 - relatórios", options());

    expect(days[0]).toMatchObject({ startMinute: hm(9), endMinute: hm(10) });
    expect(days[0]?.entries.map((entry) => [entry.startMinute, entry.minutes])).toEqual([
      [hm(9), 30],
      [hm(9, 30), 30],
    ]);
  });

  it("makes halves of a block from lines on the quarter hour, and refuses times off the grid", () => {
    const halves = parseTimeHistory(
      "19/11\n14:00 - ad\n14:15 - atendimento\n14:30 - fim",
      options(),
    );
    expect(halves.days[0]?.entries.map((entry) => [entry.startMinute, entry.minutes])).toEqual([
      [hm(14), 15],
      [hm(14, 15), 15],
    ]);

    const off = parseTimeHistory("19/11\n10:00 - a\n10:10 - b\n10:30 - fim", options());
    expect(off.issues).toEqual([
      { line: 2, message: "O trecho não fecha com os blocos de 30 minutos." },
      { line: 3, message: "O trecho não fecha com os blocos de 30 minutos." },
    ]);
  });

  it("reports each problem with its line", () => {
    const text = [
      "08:00 - antes da data", // 1
      "**31/02**", // 2
      "**20/11**", // 3
      "oi", // 4
      "09:00 - e-mail", // 5
      "08:30 - fora de ordem", // 6
      `10:00 - ${"x".repeat(301)}`, // 7
      "**20/11**", // 8
      "**30/11**", // 9
      "09:00 - futuro", // 10
    ].join("\n");

    const { issues } = parseTimeHistory(text, options());

    expect(issues).toEqual([
      { line: 1, message: "Registro antes da primeira data." },
      { line: 2, message: "Data inválida." },
      { line: 4, message: 'Linha não reconhecida. Use "DD/MM" ou "HH:MM - texto".' },
      { line: 6, message: "Horário fora de ordem no dia." },
      { line: 7, message: "O texto passa de 300 caracteres." },
      { line: 8, message: "A data 20/11 já apareceu antes." },
      { line: 9, message: "Dia no futuro." },
    ]);
  });
});
