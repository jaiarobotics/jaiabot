#!/bin/bash
# Downloads the Authelia and LLDAP releases pinned in versions.env, checks them against
# the recorded SHA-256s and lays them out as jaiabot-web-thirdparty installs them.
#
#   fetch.sh <amd64|arm64> <stage dir>   the deb build
#   fetch.sh --update-checksums          rewrite the SHA-256 lines after a version bump

set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
versions=$here/versions.env
source "$versions"

download() {
    curl -fsSL --retry 5 --retry-delay 10 --max-time 600 -o "$2" "$1"
}

authelia_url() {
    echo "https://github.com/authelia/authelia/releases/download/v${AUTHELIA_VERSION}/authelia-v${AUTHELIA_VERSION}-linux-$1.tar.gz"
}

lldap_url() {
    local arch
    case "$1" in
        amd64) arch=amd64 ;;
        arm64) arch=aarch64 ;;
        *) echo "fetch.sh: no LLDAP release for $1" >&2; exit 1 ;;
    esac
    echo "https://github.com/lldap/lldap/releases/download/v${LLDAP_VERSION}/${arch}-lldap.tar.gz"
}

lldap_bootstrap_url() {
    echo "https://raw.githubusercontent.com/lldap/lldap/v${LLDAP_VERSION}/scripts/bootstrap.sh"
}

sha256() {
    sha256sum "$1" | cut -d' ' -f1
}

verify() {
    local file=$1 expected=$2 actual
    actual=$(sha256 "$file")
    if [ "$actual" != "$expected" ]; then
        echo "fetch.sh: $file: SHA-256 $actual, versions.env says $expected" >&2
        exit 1
    fi
}

update_checksums() {
    local arch key
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    for arch in amd64 arm64; do
        key=${arch^^}
        download "$(authelia_url $arch)" "$tmp/authelia-$arch.tar.gz"
        sed -i "s/^AUTHELIA_SHA256_$key=.*/AUTHELIA_SHA256_$key=$(sha256 "$tmp/authelia-$arch.tar.gz")/" "$versions"
        download "$(lldap_url $arch)" "$tmp/lldap-$arch.tar.gz"
        sed -i "s/^LLDAP_SHA256_$key=.*/LLDAP_SHA256_$key=$(sha256 "$tmp/lldap-$arch.tar.gz")/" "$versions"
    done
    download "$(lldap_bootstrap_url)" "$tmp/bootstrap.sh"
    sed -i "s/^LLDAP_BOOTSTRAP_SHA256=.*/LLDAP_BOOTSTRAP_SHA256=$(sha256 "$tmp/bootstrap.sh")/" "$versions"
    grep SHA256 "$versions"
}

stage() {
    local arch=$1 stage=$2 key=${1^^}
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT

    local authelia_sha=AUTHELIA_SHA256_$key lldap_sha=LLDAP_SHA256_$key
    mkdir -p "$stage/usr/bin" "$stage/usr/share/lldap" "$stage/usr/libexec/lldap"

    download "$(authelia_url $arch)" "$tmp/authelia.tar.gz"
    verify "$tmp/authelia.tar.gz" "${!authelia_sha}"
    tar -xzf "$tmp/authelia.tar.gz" -C "$stage/usr/bin" authelia

    download "$(lldap_url $arch)" "$tmp/lldap.tar.gz"
    verify "$tmp/lldap.tar.gz" "${!lldap_sha}"
    mkdir -p "$tmp/lldap"
    tar -xzf "$tmp/lldap.tar.gz" -C "$tmp/lldap" --strip-components=1
    mv "$tmp/lldap/lldap" "$tmp/lldap/lldap_set_password" "$stage/usr/bin/"
    rm -rf "$stage/usr/share/lldap/app"
    mv "$tmp/lldap/app" "$stage/usr/share/lldap/app"

    download "$(lldap_bootstrap_url)" "$tmp/bootstrap.sh"
    verify "$tmp/bootstrap.sh" "$LLDAP_BOOTSTRAP_SHA256"
    install -m 0755 "$tmp/bootstrap.sh" "$stage/usr/libexec/lldap/bootstrap.sh"

    chmod 0755 "$stage/usr/bin/authelia" "$stage/usr/bin/lldap" "$stage/usr/bin/lldap_set_password"

    if [ "$(dpkg --print-architecture)" = "$arch" ]; then
        "$stage/usr/bin/authelia" --version | grep -F "v${AUTHELIA_VERSION}"
        "$stage/usr/bin/lldap" --version | grep -F "${LLDAP_VERSION}"
    fi
}

case "${1:-}" in
    --update-checksums) update_checksums ;;
    amd64|arm64)
        [ $# -eq 2 ] || { echo "usage: fetch.sh <amd64|arm64> <stage dir>" >&2; exit 2; }
        stage "$1" "$2" ;;
    *) echo "usage: fetch.sh <amd64|arm64> <stage dir> | --update-checksums" >&2; exit 2 ;;
esac
