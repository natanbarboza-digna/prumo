import { describe, expect, it } from "vitest";

import { type Deadline, groupDeadlines } from "@/modules/dashboard/rules";

const today = "2026-11-16";

function deadline(date: string, title = `Item ${date}`): Deadline {
  return { kind: "STEP", id: `${date}-${title}`, title, date, href: "/tracks/1", source: null };
}

describe("groupDeadlines", () => {
  it("splits overdue items (before today) from upcoming ones (today on)", () => {
    const groups = groupDeadlines([deadline("2026-11-15"), deadline(today)], today);

    expect(groups.overdue.items.map((item) => item.date)).toEqual(["2026-11-15"]);
    expect(groups.upcoming.items.map((item) => item.date)).toEqual([today]);
  });

  it("keeps upcoming items up to today + 13 and leaves the rest out", () => {
    const groups = groupDeadlines([deadline("2026-11-29"), deadline("2026-11-30")], today);

    expect(groups.upcoming.items.map((item) => item.date)).toEqual(["2026-11-29"]);
    expect(groups.upcoming.hidden).toBe(0);
  });

  it("orders by date, then by title", () => {
    const groups = groupDeadlines(
      [
        deadline("2026-11-20", "B"),
        deadline("2026-11-18", "Z"),
        deadline("2026-11-20", "A"),
        deadline("2026-11-10", "Atraso recente"),
        deadline("2026-10-01", "Atraso antigo"),
      ],
      today,
    );

    expect(groups.upcoming.items.map((item) => item.title)).toEqual(["Z", "A", "B"]);
    expect(groups.overdue.items.map((item) => item.title)).toEqual([
      "Atraso antigo",
      "Atraso recente",
    ]);
  });

  it("shows at most the limit per group and counts what was left out", () => {
    const items = Array.from({ length: 12 }, (_, index) => deadline(today, `Item ${index + 10}`));

    const groups = groupDeadlines(items, today, { limit: 10 });

    expect(groups.upcoming.items).toHaveLength(10);
    expect(groups.upcoming.hidden).toBe(2);
    expect(groups.overdue).toEqual({ items: [], hidden: 0 });
  });

  it("accepts another horizon", () => {
    const groups = groupDeadlines([deadline("2026-11-17"), deadline("2026-11-18")], today, {
      horizonDays: 2,
    });

    expect(groups.upcoming.items.map((item) => item.date)).toEqual(["2026-11-17"]);
  });

  it("is empty without items", () => {
    expect(groupDeadlines([], today)).toEqual({
      overdue: { items: [], hidden: 0 },
      upcoming: { items: [], hidden: 0 },
    });
  });
});
