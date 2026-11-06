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
├── nix/                  lib.mkLanding · its stand-in brand · the container smoke
└── scripts/publish.rs    `nix run .#publish`
```

```
 _sa/sites/{aquafix,vifnet} ──▶ sites_tools ──▶ web_std (@evinvest/*)
                                    │
                                    └──▶ sites_panel (@evinvest/sites-contract)
```

### Invariants

- **One way.** Nothing outside `_sa` depends on this repo; this repo depends on
  web_std and sites_panel only through published versions (npm ranges).
- **The panel's contract is not ours.** What a site reads from sites_panel and
  sends to it — the price list and its pricing, a place's live settings and
  booking, phone numbers, the experiments' overrides, every ingest event — is
  `@evinvest/sites-contract`, sites_panel's one TS form of it. The kit imports
  it and re-exports what a brand needs; it restates none of it, and builds
  every event with its `siteEvent`. A change to it is a sites_panel release
  first.
- **A brand pins one release.** `lib.mkLanding` refuses a lockfile whose
  `@evinvest/sites-tools` is not this revision's `ts/sites-tools/package.json`, so a
  brand's flake input is the `@evinvest/sites-tools-vX.Y.Z` tag of its npm version.

## Publishing

`nix run .#publish -- <level>` bumps the package, moves the template's
the package's range and `@evinvest/sites-tools-v…` pins, commits and tags; the tag
fires `release-npm.yml` (v_flakes `npmRelease`). `sites-tools-registry.yml` then
builds the template from npm, and weekly.
