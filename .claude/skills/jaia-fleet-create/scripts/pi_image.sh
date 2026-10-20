#!/bin/bash

# The Raspberry Pi image a repo's nodes are written with, from the public image
# bucket over HTTPS (no AWS login). The bucket can't be listed, so the current
# image is named by the folder's version.txt.

usage()
{
    echo "Usage: $0 <release|beta|continuous|test> [--download <dir>]"
    exit 2
}

[ $# -ge 1 ] || usage
REPO=$1
shift
DIR=""
[ "${1:-}" = "--download" ] && DIR="${2:-}"
[ "${1:-}" = "--download" ] && [ -z "$DIR" ] && usage

BASE="https://jaia-disk-images.s3.amazonaws.com/${REPO}/3.y/rpi"

if ! version_txt=$(curl -fsS -m 20 "${BASE}/version.txt"); then
    echo "No Raspberry Pi image published for ${REPO}/3.y (${BASE}/version.txt)" >&2
    exit 1
fi
name=$(echo "$version_txt" | sed -n 's/^major_upgrade_rootfs_version=//p')
version=$(echo "$version_txt" | sed -n 's/^major_upgrade_version=//p')
[ -n "$name" ] || { echo "${BASE}/version.txt names no image" >&2; exit 1; }

url="${BASE}/${name//+/%2B}.img.gz"
size=$(curl -fsSI -m 20 "$url" | awk 'tolower($1)=="content-length:"{print $2}' | tr -d '\r')
[ -n "$size" ] || { echo "The image ${url} is not there" >&2; exit 1; }

echo "release ${version}"
echo "image   ${url}"
echo "size    $((size / 1024 / 1024)) MiB (gzip; write it with Raspberry Pi Imager, or gunzip | dd)"

if [ -n "$DIR" ]; then
    mkdir -p "$DIR"
    out="${DIR}/${name}.img.gz"
    curl -fL -m 3600 --retry 3 -C - -o "$out" "$url"
    [ "$(stat -c %s "$out")" = "$size" ] && echo "downloaded ${out}" || { echo "download incomplete: ${out}" >&2; exit 1; }
fi
