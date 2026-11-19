import { describe, expect, it } from "vitest";

import { adherenceText, doneTodayText, scheduleText } from "@/modules/routines/labels";

describe("scheduleText", () => {
  it("lists the days Monday first, with the time", () => {
    expect(scheduleText({ weekdays: ["MON", "WED", "FRI"], timeOfDay: "07:00" })).toBe(
      "Seg, Qua, Sex · 07:00",
    );
  });

  it("says every day when all seven are chosen", () => {
    expect(
      scheduleText({
        weekdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
        timeOfDay: null,
      }),
    ).toBe("Todos os dias");
  });

  it("omits the time when there is none", () => {
    expect(scheduleText({ weekdays: ["SAT", "SUN"], timeOfDay: null })).toBe("Sáb, Dom");
  });
});

describe("adherenceText", () => {
  it.each([
    [{ scheduled: 0, done: 0 }, "Nenhum dia para contar ainda"],
    [{ scheduled: 1, done: 1 }, "1 de 1 dia feito"],
    [{ scheduled: 20, done: 18 }, "18 de 20 dias feitos"],
  ])("%j → %s", (adherence, expected) => {
    expect(adherenceText(adherence)).toBe(expected);
  });
});

describe("doneTodayText", () => {
  it.each([
    [0, 1, "0 de 1 feita"],
    [2, 4, "2 de 4 feitas"],
  ])("%i of %i → %s", (done, total, expected) => {
    expect(doneTodayText(done, total)).toBe(expected);
  });
});
