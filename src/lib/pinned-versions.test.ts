import { describe, expect, it } from "vitest";

import { peerVerdict, stableTagVerdict } from "@/lib/pinned-versions";

describe("peerVerdict", () => {
  it("allows the upgrade when the new version fits every holder's peer range", () => {
    expect(
      peerVerdict("10.15.0", [
        { name: "eslint-plugin-react-hooks", version: "7.1.1", range: "^9.0.0 || ^10.0.0" },
      ]),
    ).toEqual({
      upgradable: true,
      reason: "eslint-plugin-react-hooks 7.1.1 aceita ^9.0.0 || ^10.0.0",
    });
  });

  it("refuses when the new version is outside the range, saying who holds it", () => {
    expect(
      peerVerdict("7.0.2", [
        { name: "typescript-eslint", version: "8.73.0", range: ">=4.8.4 <6.1.0" },
      ]),
    ).toEqual({
      upgradable: false,
      reason: "typescript-eslint 8.73.0 aceita >=4.8.4 <6.1.0",
    });
  });

  it("understands ranges joined with ||", () => {
    const holders = [{ name: "a", version: "1.0.0", range: "^8.57.0 || ^9.0.0 || ^10.0.0" }];

    expect(peerVerdict("10.2.0", holders).upgradable).toBe(true);
    expect(peerVerdict("11.0.0", holders).upgradable).toBe(false);
  });

  it("refuses when any of several holders refuses, naming only those", () => {
    const verdict = peerVerdict("10.15.0", [
      { name: "eslint-plugin-react-hooks", version: "7.1.1", range: "^9.0.0 || ^10.0.0" },
      { name: "eslint-plugin-react", version: "7.37.5", range: "^8 || ^9.7" },
      { name: "eslint-plugin-jsx-a11y", version: "6.10.2", range: "^9" },
    ]);

    expect(verdict).toEqual({
      upgradable: false,
      reason:
        "eslint-plugin-react 7.37.5 aceita ^8 || ^9.7; eslint-plugin-jsx-a11y 6.10.2 aceita ^9",
    });
  });
});

describe("stableTagVerdict", () => {
  it("allows a stable latest that is newer than the installed version", () => {
    expect(stableTagVerdict("7.10.1", "7.11.0")).toEqual({
      upgradable: true,
      reason: "a tag latest é a 7.11.0, estável",
    });
  });

  it("refuses a prerelease latest", () => {
    expect(stableTagVerdict("7.10.1", "8.0.0-rc.34")).toEqual({
      upgradable: false,
      reason: "a tag latest aponta para 8.0.0-rc.34, que não é estável",
    });
  });

  it("says when the installed version is already the latest", () => {
    expect(stableTagVerdict("7.10.1", "7.10.1")).toEqual({
      upgradable: false,
      reason: "já está na versão mais nova",
    });
  });
});
