#!/usr/bin/env bash

set -e

source "$(dirname "$0")/build-config.sh"

(cd "${jaia_root}"; cmake -P cmake/ConfigureDockerfiles.cmake)

(set -x; docker build --build-arg distro="${distro}" --build-arg repo="${repo}" \
        --build-arg version="${version}" --no-cache -t "${image_name}" \
        "${jaia_root}/.docker/${distro}/${arch}")
