# Widget baselines

PNG per gallery page and width, compared byte for byte by
`nix run .#sites-tools-visual`. Linux only: take them from the `sites-tools-visual`
artifact of the `sites-tools` workflow, never from a mac:

```sh
rm -f ts/sites-tools/test/visual/__screenshots__/*.png
gh run download <run-id> -n sites-tools-visual -D ts/sites-tools/test/visual/__screenshots__
```
