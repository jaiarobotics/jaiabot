#!/bin/bash

if [ -z "${JAIABOT_CMAKE_FLAGS}" ]; then
    JAIABOT_CMAKE_FLAGS=
fi

if [ -z "${JAIABOT_MAKE_FLAGS}" ]; then
    JAIABOT_MAKE_FLAGS=
fi

script_dir=$(dirname $0)

ARCH=$(dpkg --print-architecture)

set -e -u
mkdir -p ${script_dir}/build/${ARCH}

# install clang-format hook if not installed
[ ! -e ${script_dir}/.git/hooks/pre-commit ] && ${script_dir}/scripts/clang-format-hooks/git-pre-commit-format install

echo "Configuring..."
cd ${script_dir}/build/${ARCH}
(set -x; cmake ../.. ${JAIABOT_CMAKE_FLAGS})
echo "Building..."
(set -x; cmake --build . -- -j`nproc` ${JAIABOT_MAKE_FLAGS} $@)
