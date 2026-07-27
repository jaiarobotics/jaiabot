#!/usr/bin/env bash

# Deploys an already cross-compiled tree to one or more bots, skipping the local web-UI build.
#
# Why this exists: docker-arm64-build-and-deploy.sh runs a full `make`, which includes the jcc
# React bundle. That bundle is a single webpack process and it gets OOM-killed when the amd64
# build image runs emulated on an arm64 Mac with a default-sized Docker VM (exit 137). Because
# the build script runs under `set -e`, that failure aborts before anything is uploaded - even
# though jcc is hub-only (config/gen/systemd.py lists jcc.conf as runs_on HUB, and arm64-deploy.sh
# only calls a2ensite jcc on the hub branch), so a bot never needs it.
#
# This runs the same rsync and the same remote arm64-deploy.sh as the official script; it just
# does not require the web target to have succeeded. For a hub, raise the Docker VM memory and use
# the official script instead.
#
# Usage:
#   ./scripts/docker-arm64-build-and-deploy.sh          # build only, ignore the jcc failure
#   jaiabot_systemd_type=bot ./scripts/arm64-deploy-bot-only.sh 172.23.5.101 [more bots...]

set -e -u

botuser=jaia
script_dir=$(dirname "$0")
jaia_root=${script_dir}/..

set -a; source "${script_dir}/common-versions.env"; set +a

repo=${jaiabot_repo:-release}
version=${jaiabot_version:-${jaia_version_release_branch}}
version_lower=$(echo "$version" | tr '[:upper:]' '[:lower:]')
distro=${jaiabot_distro:-${jaia_version_ubuntu_codename}}
build_dir=build/${distro}-${version_lower}-arm64
image_name=jaia_build_${distro}_${repo}_${version_lower}

cd "${jaia_root}"

if [ ! -x "${build_dir}/bin/jaiabot_state_estimator" ]; then
    echo "❌ ${build_dir}/bin/jaiabot_state_estimator missing - run the build first"
    exit 1
fi

if [ $# -eq 0 ]; then
    echo "❌ no targets given. Usage: jaiabot_systemd_type=bot $0 <bot-ip> [...]"
    exit 1
fi

# The remote deploy script refuses to continue unless these match the versions installed on the
# bot, so read them from the build image exactly as the official script does.
dockerPackageVersion() {
    docker run --rm -t "${image_name}" apt show "$1" 2>/dev/null |
        sed -n 's/^Version: \(.*\)~.*$/\1/p' | tr -d '\r'
}
docker_libgoby_version=$(dockerPackageVersion libgoby3)
docker_libdccl_version=$(dockerPackageVersion libdccl4)
echo "🟢 build image has libgoby3=${docker_libgoby_version} libdccl4=${docker_libdccl_version}"

for remote in "$@"; do
    echo "🟢 Uploading to ${remote}"
    rsync -za --force --relative --delete \
          --exclude node_modules/ --exclude venv/ \
          ./${build_dir}/bin ./${build_dir}/include ./${build_dir}/share/ ./${build_dir}/lib \
          ./config ./scripts "${botuser}@${remote}:/home/${botuser}/jaiabot/"

    ssh "${botuser}@${remote}" \
        "jaiabot_systemd_type=${jaiabot_systemd_type:-} \
         docker_libgoby_version=${docker_libgoby_version} \
         docker_libdccl_version=${docker_libdccl_version} \
         bash -c \"./jaiabot/scripts/arm64-deploy.sh ${build_dir}\""

    echo "✅ ${remote} deployed. Start with: ssh ${botuser}@${remote} 'sudo systemctl start jaiabot'"
done
