#!/bin/bash

##
## Usage (inside the build container):
## ./scripts/build/runtime-packages.sh <build dir> <arch>
##
## Prints the packages (name:arch, one per line) that provide the shared libraries the binaries
## and libraries in <build dir> link against.
##

set -e

build_dir=$1
arch=$2
native_arch=$(dpkg --print-architecture)

sonames=$(find "${build_dir}/bin" "${build_dir}/lib" -type f -print0 \
              | xargs -0 readelf -d 2>/dev/null \
              | sed -n 's/.*(NEEDED).*\[\(.*\)\]/\1/p' | sort -u)

# dpkg -S matches substrings (libc.so.6 also finds libc6-dev's libc.so.6-gdb.py), finds the
# cross toolchain's copies under /usr/<triplet>, and leaves the architecture off native packages
# that are not Multi-Arch: same
echo "${sonames}" | xargs -r dpkg -S 2>/dev/null \
    | awk -F': ' -v arch="${arch}" -v native="${native_arch}" '
        NR == FNR { needed[$0] = 1; next }
        $2 ~ /^(\/usr)?\/lib\// {
            n = split($2, path, "/")
            if (!(path[n] in needed)) next
            m = split($1, pkgs, ", ")
            for (i = 1; i <= m; i++) {
                pkg = pkgs[i]
                if (pkg !~ /:/) pkg = pkg ":" native
                if (pkg ~ (":" arch "$")) print pkg
            }
        }' <(echo "${sonames}") - \
    | sort -u
