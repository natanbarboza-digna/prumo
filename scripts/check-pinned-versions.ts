// `npm run check:versions`: can the pinned packages (see "Stack" in CLAUDE.md)
// move to their newest version yet? Asks the npm registry and prints one line
// per package. It only informs: the exit code is always 0.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  type Holder,
  type Verdict,
  peerVerdict,
  stableTagVerdict,
} from "../src/lib/pinned-versions";

/** `npm view <spec> <field> --json`, parsed. */
function npmView<T>(spec: string, field: string): T {
  return JSON.parse(execSync(`npm view ${spec} ${field} --json`, { encoding: "utf8" })) as T;
}

function installed(name: string): string {
  const manifest = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")) as {
    version: string;
  };
  return manifest.version;
}

/** The newest version of each holder and its peer range for `peer`. */
function holders(names: readonly string[], peer: string): Holder[] {
  return names.map((name) => {
    const version = npmView<string>(name, "version");
    const peers = npmView<Record<string, string>>(`${name}@${version}`, "peerDependencies");
    return { name, version, range: peers[peer] ?? "*" };
  });
}

function print(label: string, current: string, newest: string, verdict: Verdict): void {
  const answer = verdict.upgradable ? "pode subir" : "ainda não";
  const arrow = current === newest ? current : `${current} → ${newest}`;
  console.log(`${label} ${arrow}: ${answer} (${verdict.reason})`);
}

const typescript = npmView<string>("typescript", "version");
print(
  "TypeScript",
  installed("typescript"),
  typescript,
  peerVerdict(typescript, holders(["typescript-eslint"], "typescript")),
);

const eslint = npmView<string>("eslint", "version");
print(
  "ESLint",
  installed("eslint"),
  eslint,
  peerVerdict(
    eslint,
    holders(["eslint-plugin-react", "eslint-plugin-jsx-a11y", "eslint-plugin-import"], "eslint"),
  ),
);

const prisma = npmView<Record<string, string>>("prisma", "dist-tags").latest ?? "";
const prismaVerdict = stableTagVerdict(installed("prisma"), prisma);
print("Prisma", installed("prisma"), prisma, prismaVerdict);
if (prismaVerdict.upgradable) {
  console.log(
    "  Ao subir o Prisma, teste sem o SerialClient (src/lib/db.ts): se o aviso do pg não voltar, remova a classe.",
  );
}
