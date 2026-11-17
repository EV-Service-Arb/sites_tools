{
  inputs = {
    v_flakes.url = "github:valeratrades/v_flakes?ref=v1.6";
    # sites_tools at the tag of the @evinvest/sites-tools version in
    # package-lock.json — mkLanding refuses a mismatch.
    sites_tools.url = "github:EV-Service-Arb/sites_tools?ref=@evinvest/sites-tools-v0.32.0";
    sites_tools.inputs.v_flakes.follows = "v_flakes";
  };

  outputs = { self, v_flakes, sites_tools }:
    v_flakes.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import v_flakes.default_nixpkgs { inherit system; };
        sitePort = "59082";
        pname = "brand-landing";
        landing = sites_tools.lib.mkLanding {
          inherit pkgs v_flakes sitePort pname;
          root = ./.;
          e2ePort = "59089";
          # sites_panel's live data and the conductor's lead ingest, addressed by devops.
          connected = true;
          buildFiles = [
            "package.json"
            "package-lock.json"
            "app"
            "src"
            "assets"
            "next.config.ts"
            "tsconfig.json"
            "postcss.config.mjs"
            "proxy.ts"
            "instrumentation.ts"
          ];
          prodEnv = import ./deploy/config.nix { port = sitePort; };
          requiredFiles = [ "assets/fonts/Inter-Regular.ttf" ];
          smoke = {
            page = "/fr";
            og = "/og?l=paris";
            quote = { location = "paris"; subject = "standard"; locality = "75011"; mobile = "0612345678"; };
          };
        };
        # `nix run .#test` and errors.yml / warnings.yml, written by the dev shell
        github = v_flakes.github {
          inherit pkgs pname;
          enable = true;
          # not `inherit js`: a language module without `rs` makes the pre-commit install throw for want of a toolchain
          jobs.errors.augment = landing.js.particles.errors ++ (with landing.particles; [ e2e-typecheck e2e checks container-smoke ]);
          jobs.warnings.augment = landing.js.particles.warnings ++ [ landing.particles.npm-audit ];
          gitignore.extra = builtins.readFile "${v_flakes}/files/gitignore/js.gitignore";
        };
        # v_flakes' own hook scripts run on cargo, which `combine` puts on PATH
        combined = v_flakes.utils.combine { rust = v_flakes.rs.default_nightly system; modules = [ github landing.js ]; };
      in
      {
        inherit (landing) packages checks apps containers;
        devShells.default = landing.devShell.overrideAttrs (old: {
          shellHook = (old.shellHook or "") + combined.shellHook;
          nativeBuildInputs = (old.nativeBuildInputs or [ ]) ++ combined.enabledPackages;
        });
      }
    );
}
