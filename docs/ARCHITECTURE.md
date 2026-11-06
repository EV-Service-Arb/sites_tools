# Architecture

`EV-Service-Arb/sites_tools` is what Service-Arb's landing brands
(`_sa/sites/{aquafix,vifnet}`) are built from. Everything generic it stands on
— the UI kit, marketing, i18n, analytics — is
[`EV-Main/web_std`](https://github.com/EV-Main/web_std).

## Layout

```
sites_tools/
├── ts/sites-tools/          npm @evinvest/sites-tools: core · react · next · server · proxy · testing · cli
│   └── template/         the brand scaffold the tarball ships
├── rust/                 crate `kitstart` (publish = false): the pure core, deps ev_lib[i18n]
├── gen/                  `nix run .#gen` → ts/sites-tools/src/generated/contract.ts
├── tests/fixtures/kitstart/   vectors both ports run
├── nix/                  lib.mkLanding · its stand-in brand · the container smoke
└── scripts/publish.rs    `nix run .#publish`
```

```
 _sa/sites/{aquafix,vifnet} ──▶ sites_tools ──▶ web_std (@evinvest/*, ev_lib)
```

### Invariants

- **One way.** Nothing outside `_sa` depends on this repo; this repo depends on
  web_std only through published versions (npm ranges, crates.io `ev_lib`).
- **Rust is the source of the shared contract.** The constants both ports read
  (`HONEYPOT_FIELD`, `GONE`, `AI_CRAWLERS`, …) are emitted by `gen/` from
  `rust/`; the `generated` pre-commit hook re-runs it, and CI fails on drift.
- **Both ports run the same vectors.** `tests/fixtures/kitstart/` is compared
  as serialised text by `rust/src/tests.rs` and the TS suite; key order is part
  of the contract.
- **A brand pins one release.** `lib.mkLanding` refuses a lockfile whose
  `@evinvest/sites-tools` is not this revision's `ts/sites-tools/package.json`, so a
  brand's flake input is the `@evinvest/sites-tools-vX.Y.Z` tag of its npm version.

## The Rust core

`rust/` is the place model, the publication gate, request routing and locale
negotiation, schema.org JSON-LD, `<head>` metadata, sitemap/robots and the
form's spam barriers. No I/O, no clock (the caller passes `now`), `wasm32`-safe.
It has no consumer yet and is not published; it is what a Dioxus brand will
take.

## Publishing

`nix run .#publish -- <level>` bumps the package, moves the template's
the package's range and `@evinvest/sites-tools-v…` pins, commits and tags; the tag
fires `release-npm.yml` (v_flakes `npmRelease`). `sites-tools-registry.yml` then
builds the template from npm, and weekly.
