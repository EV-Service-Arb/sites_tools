## Layout

| Path | What |
| ---- | ---- |
| [`ts/kitstart/`](ts/kitstart/) | `@evinvest/kitstart` on npm; its README is the manual |
| [`ts/kitstart/template/`](ts/kitstart/template/) | the brand scaffold the package ships |
| [`rust/`](rust/) | crate `kitstart`: the pure core, pinned to the TS port by `tests/fixtures/kitstart/` |
| [`gen/`](gen/) | `nix run .#gen`: the TS contract, from the Rust core |
| [`nix/`](nix/) | `lib.mkLanding` |

See [ARCHITECTURE.md](docs/ARCHITECTURE.md).
