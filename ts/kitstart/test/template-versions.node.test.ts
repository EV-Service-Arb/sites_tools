import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { satisfies } from "../scripts/semver.mjs";

// scripts/publish.rs moves these on every release; this catches a hand release
// in seconds rather than in the template job's full `next build`.
const kitstart = resolve(import.meta.dirname, "..");

interface Manifest {
  version: string;
  dependencies: Record<string, string>;
}

const readManifest = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;

const { version } = readManifest(kitstart);
const template = readManifest(join(kitstart, "template"));

describe("template versions", () => {
  it("admits this kitstart", () => {
    const range = template.dependencies["@evinvest/kitstart"];
    if (range === undefined) throw new Error("the template does not depend on @evinvest/kitstart");
    expect(satisfies(version, range), `@evinvest/kitstart@${range} does not admit ${version}`).toBe(true);
  });

  it.each(["template/flake.nix", "README.md"])("%s pins sites_tools to this kitstart's tag", file => {
    const tags = readFileSync(join(kitstart, file), "utf8").match(/@evinvest\/kitstart-v\d+\.\d+\.\d+/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    expect(new Set(tags)).toEqual(new Set([`@evinvest/kitstart-v${version}`]));
  });
});
