import { describe, expect, it } from "vitest";

import { durationText, slotLabel } from "@/modules/time/labels";

describe("time labels (plan 031)", () => {
  it("writes durations in hours and minutes", () => {
    expect(durationText(0)).toBe("0min");
    expect(durationText(45)).toBe("45min");
    expect(durationText(60)).toBe("1h");
    expect(durationText(450)).toBe("7h30");
    expect(durationText(605)).toBe("10h05");
  });

  it("names a block by its start and end", () => {
    expect(slotLabel({ start: 495, end: 510 })).toBe("08:15–08:30");
  });
});
