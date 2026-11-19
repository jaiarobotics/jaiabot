#!/bin/bash
# Downloads the Natural Earth layers the stylesheet uses, at the version pinned in
# scripts/common-versions.env, checks them against natural-earth.sha256 and writes them,
# the land and coastline layers split_land_layers.py builds, and the stylesheet to <dir>.
#
#   fetch.sh <dir>                the deb build, or a development machine's
#                                 /var/log/jaiabot/lib/maps/natural_earth
#   fetch.sh --update-checksums   rewrite natural-earth.sha256 after a version change

set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$here/../scripts/common-versions.env"
checksums=$here/natural-earth.sha256

# ne_10m_land is only the input to the split layers; the stylesheet uses the rest directly
land=10m_physical/ne_10m_land
layers=(
    "$land"
    10m_physical/ne_10m_geography_marine_polys
    10m_physical/ne_10m_geography_regions_polys
    10m_physical/ne_10m_lakes
    10m_physical/ne_10m_minor_islands
    10m_physical/ne_10m_rivers_lake_centerlines
    10m_cultural/ne_10m_ports
    10m_cultural/ne_10m_urban_areas
)
extensions=(shp shx dbf prj cpg)

files() {
    local layer extension
    for layer in "${layers[@]}"; do
        for extension in "${extensions[@]}"; do
            echo "$layer.$extension"
        done
    done
}

download() {
    local dir=$1 file
    for file in $(files); do
        mkdir -p "$dir/$(dirname "$file")"
        curl -fsSL --retry 5 --retry-delay 10 --max-time 600 -o "$dir/$file" \
            "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v${jaia_version_natural_earth}/$file"
    done
}

update_checksums() {
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    download "$tmp"
    (cd "$tmp" && sha256sum $(files)) > "$checksums"
    echo "Wrote $checksums for Natural Earth ${jaia_version_natural_earth}"
}

stage() {
    local stage=$1 layer
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    download "$tmp"
    (cd "$tmp" && sha256sum --check --quiet "$checksums")

    mkdir -p "$stage"
    for layer in "${layers[@]}"; do
        [ "$layer" = "$land" ] || cp "$tmp/$layer".* "$stage/"
    done
    python3 "$here/split_land_layers.py" "$tmp/$(dirname "$land")" "$stage"
    cp "$here/stylesheet.xml.template" "$stage/"
    (cd "$here" && sha256sum $(source_files)) > "$stage/source.sha256"
}

# What a map directory was built from: src/web/run.sh refetches when these change
source_files() {
    echo fetch.sh natural-earth.sha256 split_land_layers.py stylesheet.xml.template
}

case "${1:-}" in
    --update-checksums) update_checksums ;;
    ""|-*) echo "usage: fetch.sh <dir> | --update-checksums" >&2; exit 2 ;;
    *) stage "$1" ;;
esac
