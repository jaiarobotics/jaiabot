# Offline base map

The data behind the JCC's Natural Earth base map, packaged as `jaiabot-offline-base-map`. Hubs install it to `/var/log/jaiabot/lib/maps/natural_earth/`, on the data partition; bots don't install it.

It has its own `debian/` folder so it can have its own version: hubs only download it (about 22 MB) when the map changes, not on every jaiabot upgrade.

- `stylesheet.xml.template`: the Mapnik stylesheet `src/web/server/map_tile_server` renders tiles from.
- `fetch.sh`: downloads the Natural Earth layers pinned in `scripts/common-versions.env`, checks them against `natural-earth.sha256` and runs `split_land_layers.py`.
- `split_land_layers.py`: cuts Natural Earth's continent-sized land polygons into small pieces, so a tile only reads the land it covers.
- `ci.py`: the package version, and whether the apt repo already has it.

## Version

`<Natural Earth version>+<commits that changed this folder>+<distro>`, e.g. `5.1.2+3+ubuntu26.04`. Every commit to this folder raises it, so there is no changelog to bump. CI builds and uploads the package only when the apt repo it uploads to doesn't have that version yet.

## Development machines and the simulator

A development machine has no binary jaiabot packages, so `scripts/build/setup-tools-runtime.sh` downloads the map instead. To refresh it after the map changes:

    offline_base_map/fetch.sh /var/log/jaiabot/lib/maps/natural_earth
    rm -f /var/log/jaiabot/cache/mapnik_tiles/stylesheet.xml/*.png

The Docker simulator image installs the package.

## Building the package locally

Needs `debhelper`, `python3-gdal` and `curl`.

    cd offline_base_map
    dpkg-buildpackage -us -uc -b

A local build is version 0, so the next package from the apt repo replaces it.

## Updating Natural Earth

After changing `jaia_version_natural_earth` in `scripts/common-versions.env`, run `fetch.sh --update-checksums`, commit `natural-earth.sha256` and check the map in the JCC.
