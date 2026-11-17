// Can a pinned package move to its newest version? Pure rules, no network:
// scripts/check-pinned-versions.ts fetches the data and prints the verdicts.

import semver from "semver";

export type Verdict = { upgradable: boolean; reason: string };

/** A package whose peer dependency range limits the upgrade (e.g. typescript-eslint for TypeScript). */
export type Holder = { name: string; version: string; range: string };

/**
 * The new version can be installed only if it fits the peer range of every
 * holder. The reason names the holders that refuse it, or all of them when none does.
 */
export function peerVerdict(newVersion: string, holders: readonly Holder[]): Verdict {
  const describe = (holder: Holder) => `${holder.name} ${holder.version} aceita ${holder.range}`;
  const refusing = holders.filter(
    (holder) => !semver.satisfies(newVersion, holder.range, { includePrerelease: false }),
  );
  if (refusing.length > 0) {
    return { upgradable: false, reason: refusing.map(describe).join("; ") };
  }
  return { upgradable: true, reason: holders.map(describe).join("; ") };
}

/** For packages whose `latest` tag may point to a prerelease (Prisma's RCs). */
export function stableTagVerdict(installed: string, latest: string): Verdict {
  if (semver.prerelease(latest) !== null) {
    return { upgradable: false, reason: `a tag latest aponta para ${latest}, que não é estável` };
  }
  if (!semver.gt(latest, installed)) {
    return { upgradable: false, reason: "já está na versão mais nova" };
  }
  return { upgradable: true, reason: `a tag latest é a ${latest}, estável` };
}
