#!/usr/bin/env bash


##
## Usage:
## jaiabot_systemd_type=hub ./docker-cloudhub-build-and-deploy.sh cloudhub-fleet1
##
## The amd64 (x86_64) counterpart to docker-arm64-build-and-deploy.sh: builds native x86_64
## binaries (no cross-compile) for targets such as CloudHub, VirtualHub/VirtualBot and
## VirtualBox development machines.
##
## CloudHubs are an x86_64 system, so we need an amd64 build to deploy custom code to them. 
##
## Command line arguments is a list of targets to push deployed code to.
## If omitted, the code is just built, but not pushed
## Env var "jaiabot_systemd_type" can be set to one of: bot, hub, which will generate and enable the appropriate systemd services. If unset, the systemd services will not be installed and enabled
## Env var "jaiabot_repo" can be set to one of: release, continuous, beta, test, which will set the repository to use for install 'apt' dependencies in the Docker container. If unset, "release" will be used.
## Env var "jaiabot_version" can be set to one of: 1.y, 2.y, etc. which will set the version of the 'apt' repository. If unset, the value of "$jaia_version_release_branch" will be used (the default for this current branch).
## Env var "jaiabot_distro" can be set to one of: focal, jammy which will set the Ubuntu distribution to use. If unset, the value of "$jaia_version_ubuntu_codename" will be used.

set -e

botuser=jaia

# The amd64 build image is the one docker-build-build-system.sh tags for "virtualbox"
export jaiabot_machine_type=virtualbox

function dockerPackageVersion() {
    docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t ${image_name} apt show $1 | sed -n 's/^Version: \(.*\)~.*$/\1/p'
}

# rsync/ssh need IPv6 literals bracketed, but hostnames and IPv4 addresses must not be
function rsyncHost() {
    if [[ "$1" == *:* ]]; then echo "[$1]"; else echo "$1"; fi
}

script_dir=$(dirname $0)

set -a; source ${script_dir}/common-versions.env; set +a

repo=${jaiabot_repo:-release}

default_version=${jaia_version_release_branch}
version=${jaiabot_version:-${default_version}}
version_lower=$(echo "$version" | tr '[:upper:]' '[:lower:]')
distro=${jaiabot_distro:-${jaia_version_ubuntu_codename}}

cd ${script_dir}/..

build_dir=build/${distro}-${version_lower}-amd64-vbox
mkdir -p ${build_dir}

image_name=jaia_build_vbox_${distro}_${repo}_${version_lower}

if [ "$(docker image ls ${image_name} --format='true')" != "true" ];
then
    echo "🟢 Building the docker ${image_name} image"
    ./scripts/docker-build-build-system.sh
fi

echo "🟢 Building jaiabot apps using docker ${image_name} image to ${build_dir}"
docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t ${image_name} bash -c "./scripts/amd64-build-vbox.sh ${build_dir}"

# Get goby and dccl versions currently installed into the build image
docker_libgoby_version=$(dockerPackageVersion libgoby3)
docker_libdccl_version=$(dockerPackageVersion libdccl4)

# Remove old library files
echo "🟢 Cleaning old library files"
docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot/scripts -t ${image_name} bash -c "./clean-lib-directory.py"

if [ -z "$1" ]
then
    echo "             -----------"
    echo "Not Deploying as you didn't specify any targets"
else
    for remote in "$@"
    do
        echo "🟢 Verifying ${remote} is x86_64"
        remote_arch=$(ssh ${botuser}@"${remote}" uname -m)
        if [ "${remote_arch}" != "x86_64" ]; then
            echo "❌ ${remote} reports architecture '${remote_arch}', not x86_64. Use docker-arm64-build-and-deploy.sh for arm64 targets."
            exit 1
        fi

        echo "🟢 Uploading to "$remote
        # Sync all directories
        rsync -za --force --relative --delete --exclude node_modules/ --exclude venv/ ./${build_dir}/bin ./${build_dir}/include ./${build_dir}/share/ ./${build_dir}/lib ./config ./scripts ${botuser}@"$(rsyncHost ${remote})":/home/${botuser}/jaiabot/

        # Login to the target, and deploy the software (arm64-deploy.sh is architecture agnostic)
        ssh ${botuser}@"${remote}" "jaiabot_systemd_type=${jaiabot_systemd_type} jaiabot_machine_type=${jaiabot_machine_type} docker_libgoby_version=${docker_libgoby_version} docker_libdccl_version=${docker_libdccl_version} bash -c \"./jaiabot/scripts/arm64-deploy.sh ${build_dir}\""

        if [ ! -z $jaiabot_systemd_type ]; then
            echo "When you're ready, ssh ${botuser}@${remote} and run 'sudo systemctl start jaiabot'"
        fi

    done
fi
