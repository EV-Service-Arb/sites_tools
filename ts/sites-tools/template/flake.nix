{
  inputs = {
    v_flakes.url = "github:valeratrades/v_flakes?ref=v1.6";
    # sites_tools at the tag of the @evinvest/sites-tools version in
    # package-lock.json — mkLanding refuses a mismatch.
    sites_tools.url = "github:EV-Service-Arb/sites_tools?ref=@evinvest/sites-tools-v0.29.0";
    sites_tools.inputs.v_flakes.follows = "v_flakes";
  };

  outputs = { self, v_flakes, sites_tools }:
    v_flakes.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import v_flakes.default_nixpkgs { inherit system; };
        sitePort = "59082";
        landing = sites_tools.lib.mkLanding {
          inherit pkgs v_flakes sitePort;
          root = ./.;
          pname = "brand-landing";
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
      in
      {
        inherit (landing) packages checks apps containers;
        devShells.default = landing.devShell;
      }
    );
}
