{
  inputs = {
    v_flakes.url = "github:valeratrades/v_flakes?ref=v1.6";
  };

  outputs = { self, v_flakes }:
    let
      inherit (v_flakes) flake-utils pre-commit-hooks;
    in
    flake-utils.lib.eachDefaultSystem
      (
        system:
        let
          pkgs = import v_flakes.default_nixpkgs { inherit system; };
          rust = v_flakes.rs.default_nightly system;

          pname = "sites_tools";

          # `nix run .#gen`: the kitstart contract the TS port reads, from the Rust core.
          gen = pkgs.writeShellApplication {
            name = "gen";
            runtimeInputs = [ rust pkgs.git ];
            text = ''
              cd "$(git rev-parse --show-toplevel)"
              exec cargo run -q -p sites_tools_gen "$@"
            '';
          };

          pre-commit-check = pre-commit-hooks.lib.${system}.run (
            let base = v_flakes.files.preCommit { inherit pkgs; }; in
            base // {
              hooks = base.hooks // {
                generated = {
                  enable = true;
                  name = "regenerate derived files";
                  entry = "bash -c '${gen}/bin/gen && git add -A ts/kitstart/src/generated'";
                  pass_filenames = false;
                  require_serial = true;
                };
              };
            }
          );

          rs = v_flakes.rs {
            inherit pkgs rust;
            build.enable = false;
          };

          github = v_flakes.github {
            inherit pkgs pname rs;
            enable = true;
            lastSupportedVersion = "nightly-2026-05-12";
            gitignore.extra = ''
              ## Node / TypeScript
              **/node_modules
              **/dist/
              **/*.tsbuildinfo
              ## LLMs
              AGENTS.md
              CLAUDE.md
              .claude/
            '';
            lfs = false;
            npmRelease = {
              scope = "evinvest";
              packagesDir = "ts";
            };
          };

          readme = v_flakes.readme-fw {
            inherit pkgs pname;
            defaults = true;
            lastSupportedVersion = "nightly-1.92";
            rootDir = ./.;
            badges = [ "msrv" ];
          };

          combined = v_flakes.utils.combine { inherit rust; modules = [ rs github readme ]; };

          # `nix run .#publish -- <major|minor|patch>`: bump `@evinvest/kitstart`,
          # move the template onto it, tag; the pushed tag is what CI publishes.
          publish = pkgs.writeShellApplication {
            name = "publish";
            runtimeInputs = [ rust pkgs.nodejs pkgs.git pkgs.treefmt pkgs.nixpkgs-fmt ];
            text = ''
              cd "$(git rev-parse --show-toplevel)"
              exec cargo -Zscript -q scripts/publish.rs "$@"
            '';
          };

          mkLandingFixture = import ./nix/mk-landing.nix {
            inherit pkgs v_flakes;
            root = ./nix/mk-landing-fixture;
            pname = "mk-landing-fixture";
            sitePort = "59099";
            connected = true;
            buildFiles = [ "package.json" "package-lock.json" "build.mjs" ];
            requiredFiles = [ "assets/fonts/Display.ttf" ];
            prodEnv = {
              LEADS_DB_PATH = "/data/leads.db";
              NODE_ENV = "production";
              HOSTNAME = "0.0.0.0";
              PORT = "59099";
            };
            smoke = {
              page = "/fr";
              og = "/og";
              quote = { location = "paris"; subject = "standard"; locality = "75011"; mobile = "0612345678"; };
            };
            containerAttr = ".#mk-landing-fixture-container";
            # The stand-in builds no kitstart landing, so it locks no kitstart.
            checkKitstartVersion = false;
            # A package the registry does not have (its `resolved` 404s), served
            # from a vendored tarball — how a brand builds before a release.
            packageSourceOverrides."node_modules/fixture-vendored" = ./nix/mk-landing-fixture/vendor/fixture-vendored-1.0.0.tgz;
          };

          # ── Visual regression (ts/kitstart/test/visual) ─────────────────────
          # Every input the render reads is pinned here; the suite compares byte
          # for byte, so an unpinned input is a baseline that moves under whoever
          # runs next.
          visual =
            let
              fonts = pkgs.google-fonts.override { fonts = [ "Inter" "PlayfairDisplay" ]; };
            in
            rec {
              # Not `makeFontsConf`: it includes /etc/fonts/conf.d, putting the host's fonts back in scope.
              fontsConf = pkgs.writeText "kitstart-visual-fonts.conf" ''
                <?xml version="1.0"?>
                <!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
                <fontconfig>
                  <dir>${fonts}/share/fonts</dir>
                  <cachedir prefix="xdg">fontconfig</cachedir>
                </fontconfig>
              '';

              # Served out of dist/ as `tailwind.js`: the snapshot derivation builds without network.
              tailwind = pkgs.fetchurl {
                url = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.14/dist/index.global.js";
                hash = "sha256-A4qFxQabLpAsXaQEn91022pgUy99EQcn+kWhVrYQ64U=";
              };

              nodeModules = "${pkgs.playwright-test}/lib/node_modules";

              env = {
                FONTCONFIG_FILE = "${fontsConf}";
                PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
                PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
                TAILWIND_BROWSER_JS = "${tailwind}";
              };
            };

          # The render is OS-sensitive, so capture is always a *-linux derivation.
          linuxSystem = builtins.replaceStrings [ "darwin" ] [ "linux" ] system;

          kitstartSnapshotsFrom =
            dist:
            pkgs.runCommand "kitstart-visual-snapshots"
              (
                visual.env
                // {
                  nativeBuildInputs = [ pkgs.playwright-test pkgs.python3 ];
                }
              )
              ''
                mkdir -p "$out" "$NIX_BUILD_TOP/run"
                cd "$NIX_BUILD_TOP/run"
                cp -r ${dist} dist
                cp ${./ts/kitstart/test/visual/gallery.spec.ts} gallery.spec.ts
                cp ${./ts/kitstart/test/visual/playwright.config.ts} playwright.config.ts
                cp ${./ts/kitstart/test/visual/package.json} package.json
                ln -s ${visual.nodeModules} node_modules
                export HOME="$NIX_BUILD_TOP" KITSTART_SNAPSHOT_OUT="$out"
                playwright test
              '';

          # Set by `kitstart-visual` below, via `nix store add-path`.
          kitstartDistPath = builtins.getEnv "KITSTART_VISUAL_DIST";

          kitstart-visual-app = pkgs.writeShellApplication {
            name = "kitstart-visual";
            runtimeInputs = [ pkgs.nodejs pkgs.git pkgs.diffutils ];
            text = ''
              cd "$(git rev-parse --show-toplevel)/ts/kitstart"
              shots=test/visual/__screenshots__
              [ -d node_modules ] || npm ci --ignore-scripts
              KITSTART_VISUAL_OUT="$PWD/test/visual/dist" npx vitest run test/visual/gallery.node.test.tsx
              cp ${visual.tailwind} test/visual/dist/tailwind.js

              dist=$(nix store add-path test/visual/dist --name kitstart-visual-dist)
              out=$(KITSTART_VISUAL_DIST="$dist" nix build --impure --no-link --print-out-paths \
                ".#packages.${linuxSystem}.kitstart-visual-snapshots")

              if [ "''${1-}" = "--update" ]; then
                rm -f "$shots"/*.png
                install -m644 "$out"/*.png "$shots"/
                echo "kitstart baselines updated from $out"
              else
                diff -rq --exclude=README.md "$out" "$shots"
              fi
            '';
          };
        in
        {
          apps.help = {
            type = "app";
            program = "${pkgs.writeShellScriptBin "help" ''
              cat <<'EOF'
              ${pname} — Service-Arb landing machinery: @evinvest/kitstart, its Rust core, lib.mkLanding

              Commands:
                nix develop                              dev shell (rust nightly, node, playwright, pre-commit)
                nix run .#gen                            regenerate ts/kitstart/src/generated from the Rust core
                nix run .#publish -- <major|minor|patch> bump + tag @evinvest/kitstart (CI publishes the tag)
                nix run .#kitstart-visual [-- --update]  visual regression of the kitstart widget gallery
                nix run .#mk-landing-smoke               smoke the mk-landing fixture container (linux + docker)
                nix build .#checks.<system>.mk-landing-budget   mk-landing bundle size gate

              Docs: README.md, docs/ARCHITECTURE.md, ts/kitstart/README.md
              EOF
            ''}/bin/help";
          };

          apps.publish = {
            type = "app";
            program = "${publish}/bin/publish";
          };

          apps.gen = {
            type = "app";
            program = "${gen}/bin/gen";
          };

          apps.kitstart-visual = {
            type = "app";
            program = "${kitstart-visual-app}/bin/kitstart-visual";
          };

          # `lib.mkLanding` against a stand-in brand: the hermetic npm build from
          # its lockfile, the standalone install checks, the size gate, and on
          # Linux the image and its smoke.
          checks = {
            mk-landing-site = mkLandingFixture.checks.site;
            mk-landing-budget = mkLandingFixture.checks.bundle-budget;
          }
          // pkgs.lib.optionalAttrs pkgs.stdenv.isLinux {
            mk-landing-container = mkLandingFixture.packages.container;
          };

          packages.mk-landing-fixture-container = mkLandingFixture.packages.container or mkLandingFixture.site;
          apps.mk-landing-smoke = mkLandingFixture.apps.container-smoke;

          packages.kitstart-visual-snapshots =
            if kitstartDistPath == "" then
              pkgs.runCommand "kitstart-visual-snapshots-no-dist" { } ''
                echo "KITSTART_VISUAL_DIST is unset — this is built through \`nix run .#kitstart-visual\`." >&2
                exit 1
              ''
            else
              kitstartSnapshotsFrom (builtins.storePath kitstartDistPath);

          devShells.default =
            with pkgs;
            mkShell {
              shellHook =
                pre-commit-check.shellHook
                + combined.shellHook
                + ''
                  cp -f ${(v_flakes.files.treefmt) { inherit pkgs; }} ./.treefmt.toml
                  export DYLD_FALLBACK_LIBRARY_PATH="${rust}/lib''${DYLD_FALLBACK_LIBRARY_PATH:+:$DYLD_FALLBACK_LIBRARY_PATH}"
                '';

              packages = [
                nodejs
                rust
                playwright-driver.browsers
                playwright-test
              ]
              ++ lib.optionals stdenv.isLinux [ mold ]
              ++ pre-commit-check.enabledPackages
              ++ combined.enabledPackages;

              env = visual.env // {
                RUST_BACKTRACE = 1;
              };
            };
        }
      )
    // {
      # `sites_tools.lib.mkLanding { pkgs; root = ./.; pname; sitePort; buildFiles; … }`
      # — the shared flake of every kitstart landing. See nix/mk-landing.nix.
      lib.mkLanding = import ./nix/mk-landing.nix;
    };
}
