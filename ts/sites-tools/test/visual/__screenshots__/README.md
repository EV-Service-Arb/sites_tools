# Widget baselines

PNG per gallery page and width, compared byte for byte by
`nix run .#sites-tools-visual`. Linux only: take them from the `visual-snapshots`
artifact of the `visual-baselines` workflow, never from a mac:

```sh
rm -f ts/sites-tools/test/visual/__screenshots__/*.png
gh run download <run-id> -n visual-snapshots -D ts/sites-tools/test/visual/__screenshots__
```
