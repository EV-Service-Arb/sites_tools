# sites_tools
![Minimum Supported Rust Version](https://img.shields.io/badge/nightly-1.92+-ab6000.svg)

Service-Arb's landing machinery: `@evinvest/kitstart` (the TypeScript a brand's
Next site is built from), its pure Rust core, and `lib.mkLanding`, the flake
every brand's `flake.nix` is one call to.

## Usage
### Layout

| Path | What |
| ---- | ---- |
| [`ts/kitstart/`](ts/kitstart/) | `@evinvest/kitstart` on npm; its README is the manual |
| [`ts/kitstart/template/`](ts/kitstart/template/) | the brand scaffold the package ships |
| [`rust/`](rust/) | crate `kitstart`: the pure core, pinned to the TS port by `tests/fixtures/kitstart/` |
| [`gen/`](gen/) | `nix run .#gen`: the TS contract, from the Rust core |
| [`nix/`](nix/) | `lib.mkLanding` |

See [ARCHITECTURE.md](docs/ARCHITECTURE.md).



<br>

<sup>
	This repository follows <a href="https://github.com/valeratrades/.github/tree/master/best_practices">my best practices</a> and <a href="https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md">Tiger Style</a> (except "proper capitalization for acronyms": (VsrState, not VSRState) and formatting). For project's architecture, see <a href="./docs/ARCHITECTURE.md">ARCHITECTURE.md</a>.
</sup>

#### License

<sup>
	Licensed under <a href="LICENSE">Blue Oak 1.0.0</a>
</sup>

<br>

<sub>
	Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be licensed as above, without any additional terms or conditions.
</sub>

