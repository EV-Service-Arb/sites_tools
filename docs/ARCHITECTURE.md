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
```

### Invariants

- **One way.** Nothing outside `_sa` depends on this repo; this repo depends on
  web_std only through published versions (npm ranges).
- **A brand pins one release.** `lib.mkLanding` refuses a lockfile whose
  `@evinvest/sites-tools` is not this revision's `ts/sites-tools/package.json`, so a
  brand's flake input is the `@evinvest/sites-tools-vX.Y.Z` tag of its npm version.

## Publishing

`nix run .#publish -- <level>` bumps the package, moves the template's
the package's range and `@evinvest/sites-tools-v…` pins, commits and tags; the tag
fires `release-npm.yml` (v_flakes `npmRelease`). `sites-tools-registry.yml` then
builds the template from npm, and weekly.
