#!/usr/bin/env bash
#
# Installs the apt runtime dependencies of the given jaiabot binary packages, read from the
# "Depends" fields in debian/control. setup-tools-build.sh covers Build-Depends via
# "apt-get build-dep"; these are the packages the built code needs at run time, which a
# developer running from a source tree would otherwise not have.
#
# This matters for the Python venv in particular: build_venv.sh creates it with
# --system-site-packages, so several pyjaia imports (geojson, shapely, matplotlib, ...) resolve
# to system packages rather than anything in requirements.txt.
#
# Usage: install-runtime-deps.sh <binary package> [<binary package> ...]
#   e.g. install-runtime-deps.sh jaiabot-python jaiabot-web
#
# Packages already installed are skipped, so the common case needs neither sudo nor network.
# Failure to install is a warning, not an error - the caller is better placed to decide whether
# a missing package is fatal.

set -u -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <binary package> [<binary package> ...]" >&2
    exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
control="${script_dir}/../../debian/control"

if [ ! -f "${control}" ]; then
    echo "🔴 ${control} not found" >&2
    exit 1
fi

# Pull the Depends fields of the requested stanzas out of the deb822 control file, then reduce
# each entry to a bare package name: drop version constraints "(>= 1.0)", architecture
# qualifiers "[amd64]", build profiles "<!nodoc>", substvars "${shlibs:Depends}", and the
# jaiabot packages this tree builds itself.
depends=$(awk -v wanted=" $* " '
    /^[^ \t]/ { collecting = 0 }
    /^$/      { pkg = "" }
    /^Package:[ \t]*/ {
        pkg = $2
        next
    }
    /^Depends:[ \t]*/ {
        if (index(wanted, " " pkg " ") > 0) {
            collecting = 1
            sub(/^Depends:[ \t]*/, "")
            print
        }
        next
    }
    collecting && /^[ \t]/ { print }
' "${control}" |
    tr ',' '\n' |
    sed -e 's/([^)]*)//g' -e 's/\[[^]]*\]//g' -e 's/<[^>]*>//g' \
        -e 's/[[:space:]]//g' |
    grep -v '^\${' |
    grep -v '^\(lib\)\?jaiabot' |
    grep -v '^$' |
    sort -u)

if [ -z "${depends}" ]; then
    echo "🔴 no Depends found in ${control} for: $*" >&2
    exit 1
fi

missing=()
for pkg in ${depends}; do
    if ! dpkg-query -W -f='${Status}' "${pkg}" 2>/dev/null | grep -q "^install ok installed$"; then
        missing+=("${pkg}")
    fi
done

if [ ${#missing[@]} -eq 0 ]; then
    echo "🟢 Runtime dependencies of $* are already installed"
    exit 0
fi

echo "🟢 Installing ${#missing[@]} missing runtime dependencies of $*: ${missing[*]}"

if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
elif command -v sudo > /dev/null 2>&1; then
    SUDO="sudo"
else
    echo "⚠️  Cannot install ${missing[*]}: this needs root or sudo. Continuing anyway." >&2
    exit 0
fi

if ! $SUDO apt-get -y install "${missing[@]}"; then
    # most likely just stale package lists
    $SUDO apt-get -y update || true
    if ! $SUDO apt-get -y install "${missing[@]}"; then
        echo "⚠️  Could not install: ${missing[*]}" >&2
        echo "⚠️  Continuing anyway; later steps will fail if any of these are actually needed." >&2
    fi
fi
