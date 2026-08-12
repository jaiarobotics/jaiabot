#!/usr/bin/env bash

##
## Usage:
## ./container-build-and-deploy.sh 172.20.11.102
##
## Cross-compiles this source tree in the build Docker container and deploys it to each of the
## targets given on the command line. If no targets are given, the code is just built, but not
## pushed. "jaia dev local_deploy" is a friendlier front end that takes host codes (e.g. b1f6)
## rather than addresses, and exposes the environmental variables below as command line flags.
##
## The systemd services are always generated and enabled for the target's type (bot or hub), which
## is read from the target's own debconf database.
##
## Env var "jaiabot_debconf_selections" can be set to a debconf-set-selections format file to configure the target from that file instead of from the target's own debconf database
## Env var "jaiabot_machine_type" can be set to one of: virtualbox, which will build amd64 binaries instead. If unset, the target will be the standard arm64 embedded system.
## Env var "jaiabot_repo" can be set to one of: release, continuous, beta, test, which will set the repository to use for install 'apt' dependencies in the Docker container. If unset, "release" will be used.
## Env var "jaiabot_version" can be set to one of: 1.y, 2.y, etc. which will set the version of the 'apt' repository. If unset, the value of "$jaia_version_release_branch" will be used (the default for this current branch).
## Env var "jaiabot_distro" can be set to one of: focal, jammy which will set the Ubuntu distribution to use. If unset, the value of "$jaia_version_ubuntu_codename" will be used.

set -e

botuser=jaia
script_dir=$(cd "$(dirname "$0")" && pwd)

source "${script_dir}/build-config.sh"

cd "${jaia_root}"

docker_run() {
    docker run --env JAIA_BUILD_NPROC --env jaiabot_machine_type \
           -v "${jaia_root}":/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot "$@"
}

if [ "$(docker image ls ${image_name} --format='true')" != "true" ]; then
    echo "🟢 Building the docker ${image_name} image"
    "${script_dir}/docker-build-build-system.sh"
fi

echo "🟢 Building jaiabot apps using docker ${image_name} image to ${build_dir}"
docker_run -t ${image_name} ./scripts/build/container-build.sh "${build_dir}"

echo "🟢 Cleaning old library files"
docker_run -t ${image_name} ./scripts/build/clean-lib-directory.py

# The targets must have the same goby and dccl versions as the image the binaries were built against
image_package_version() {
    docker_run ${image_name} dpkg-query -W -f='${Version}' "$1" | sed 's/~.*//'
}
docker_libgoby_version=$(image_package_version libgoby3)
docker_libdccl_version=$(image_package_version libdccl5)

if [ $# -eq 0 ]; then
    echo "             -----------"
    echo "Not Deploying as you didn't specify any targets"
    exit 0
fi

for remote in "$@"; do
    echo "🟢 Uploading to ${remote}"

    # Generated inside the loop: each bot has its own bot_id, so one file
    # made before it would give every target in the deploy the same identity.
    selections=${build_dir}/jaiabot-embedded.selections

    if [ -n "${jaiabot_debconf_selections}" ]; then
        echo "🟢 Using debconf selections from ${jaiabot_debconf_selections}"
        cp "${jaiabot_debconf_selections}" "${selections}"
    else
        echo "🟢 Reading debconf selections from ${remote}"
        # debconf-get-selections writes 'unknown' as the owner when the package
        # isn't registered; rewrite as jaia-create-fleet-config.sh does
        ssh ${botuser}@"${remote}" "sudo debconf-get-selections | grep 'jaiabot-embedded/'" \
            | sed 's/^unknown/jaiabot-embedded/' > "${selections}"
    fi

    if [ ! -s "${selections}" ]; then
        echo "❌ No jaiabot-embedded debconf answers found for ${remote}."
        echo "   Install jaiabot-embedded there first, or set jaiabot_debconf_selections=<file>."
        exit 1
    fi

    rsync -za --force --relative --delete --exclude node_modules/ --exclude venv/ \
          ./${build_dir}/bin ./${build_dir}/include ./${build_dir}/share/ ./${build_dir}/lib \
          ./${selections} ./config ./scripts ./src/sh \
          ${botuser}@"${remote}":/home/${botuser}/jaiabot/

    # Login to the target, and deploy the software
    ssh ${botuser}@"${remote}" \
        "docker_libgoby_version=${docker_libgoby_version} docker_libdccl_version=${docker_libdccl_version} ./jaiabot/scripts/build/target-deploy.sh ${build_dir}"

    echo "When you're ready, ssh ${botuser}@${remote} and run 'sudo systemctl start jaiabot'"
done
