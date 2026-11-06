import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { satisfies } from "../scripts/semver.mjs";

// scripts/publish.rs moves these on every release; this catches a hand release
// in seconds rather than in the template job's full `next build`.
const pkgRoot = resolve(import.meta.dirname, "..");

interface Manifest {
  version: string;
  dependencies: Record<string, string>;
}

const readManifest = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;

const { version } = readManifest(pkgRoot);
const template = readManifest(join(pkgRoot, "template"));

describe("template versions", () => {
  it("admits this release", () => {
    const range = template.dependencies["@evinvest/sites-tools"];
    if (range === undefined) throw new Error("the template does not depend on @evinvest/sites-tools");
    expect(satisfies(version, range), `@evinvest/sites-tools@${range} does not admit ${version}`).toBe(true);
  });

  it.each(["template/flake.nix", "README.md"])("%s pins sites_tools to this release's tag", file => {
    const tags = readFileSync(join(pkgRoot, file), "utf8").match(/@evinvest\/sites-tools-v\d+\.\d+\.\d+/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    expect(new Set(tags)).toEqual(new Set([`@evinvest/sites-tools-v${version}`]));
  });
});
