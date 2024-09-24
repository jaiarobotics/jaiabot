#!/usr/bin/env bash

##
## Usage:
## jaiabot_arduino_type=usb_old jaiabot_systemd_type=bot ./docker-arm64-build-and-deploy.sh 172.20.11.102
##
## Command line arguments is a list of Jaiabots to push deployed code to.
## If omitted, the code is just built, but not pushed
## Env var "jaiabot_arduino_type" can be set to one of: usb, spi, which will upload the arduino code (jaiabot_runtime) based on the connection type. If unset, the arduino code will not be flashed.
## Env var "jaiabot_systemd_type" can be set to one of: bot, hub, which will generate and enable the appropriate systemd services. If unset, the systemd services will not be installed and enabled
## Env var "jaiabot_machine_type" can be set to one of: virtualbox, which will build amd64 binaries instead. If unset, the target will be the standard arm64 embedded system.
## Env var "jaiabot_repo" can be set to one of: release, continuous, beta, test, which will set the repository to use for install 'apt' dependencies in the Docker container. If unset, "release" will be used.
## Env var "jaiabot_version" can be set to one of: 1.y, 2.y, etc. which will set the version of the 'apt' repository. If unset, the contents of "release_branch" will be used (the default for this current branch).
## Env var "jaiabot_distro" can be set to one of: noble which will set the Ubuntu distribution to use. If unset, the contents of "ubuntu_release" will be used.

set -e

botuser=jaia

function dockerPackageVersion() {
    docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t ${image_name} apt show $1 | sed -n 's/^Version: \(.*\)~.*$/\1/p'
}

script_dir=$(dirname $0)

repo=${jaiabot_repo:-release}

default_version=$(<release_branch)
version=${jaiabot_version:-${default_version}}
version_lower=$(echo "$version" | tr '[:upper:]' '[:lower:]')
default_distro=$(<ubuntu_release)
distro=${jaiabot_distro:-${default_distro}}

# install clang-format hook if not installed
[ ! -e ${script_dir}/../.git/hooks/pre-commit ] && ${script_dir}/../scripts/git-hooks/clang-format-hooks/git-pre-commit-format install

if [[ "$jaiabot_machine_type" == "virtualbox" ]]; then
    cd ${script_dir}/..

    build_dir=build/amd64-vbox   
    mkdir -p ${build_dir}

    image_name=jaia_build_vbox_${distro}_${repo}_${version_lower}

    if [ "$(docker image ls ${image_name} --format='true')" != "true" ];
    then
        echo "🟢 Building the docker ${image_name} image"
        ./scripts/docker-build-build-system.sh
    fi

    echo "🟢 Building jaiabot apps using docker ${image_name} image"
    docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t ${image_name} bash -c "./scripts/amd64-build-vbox.sh"

else    
    cd ${script_dir}/..

    build_dir=build/arm64
    mkdir -p ${build_dir}
    image_name=jaia_build_${distro}_${repo}_${version_lower}


    if [ "$(docker image ls ${image_name} --format='true')" != "true" ];
    then
        echo "🟢 Building the docker ${image_name} image"
        ./scripts/docker-build-build-system.sh
    fi

    echo "🟢 Building jaiabot apps using docker ${image_name} image"
    docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t ${image_name} bash -c "./scripts/arm64-build.sh"
fi

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
        echo "🟢 Uploading to "$remote
        # Sync all directories
        rsync -za --force --relative --delete --exclude node_modules/ --exclude venv/ ./${build_dir}/bin ./${build_dir}/include ./${build_dir}/share/ ./${build_dir}/lib ./src/web/jcc.conf ./config ./scripts ${botuser}@"$remote":/home/${botuser}/jaiabot/

        # Login to the target, and deploy the software
        ssh ${botuser}@"${remote}" "jaiabot_systemd_type=${jaiabot_systemd_type} jaiabot_arduino_type=${jaiabot_arduino_type} jaiabot_machine_type=${jaiabot_machine_type} docker_libgoby_version=${docker_libgoby_version} docker_libdccl_version=${docker_libdccl_version} bash -c ./jaiabot/scripts/arm64-deploy.sh"

        if [ ! -z $jaiabot_systemd_type ]; then
            echo "When you're ready, ssh ${botuser}@${hostname} and run 'sudo systemctl start jaiabot'"
        fi

    done
fi

