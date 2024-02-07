#!/usr/bin/env bash

##
## Usage:
## jaiabot_arduino_type=usb_old jaiabot_systemd_type=bot ./docker-arm64-build-and-deploy.sh 172.20.11.102
##
## Command line arguments is a list of Jaiabots to push deployed code to.
## If omitted, the code is just built, but not pushed
## Env var "jaiabot_arduino_type" can be set to one of: usb, spi, which will upload the arduino code (jaiabot_runtime) based on the connection type. If unset, the arduino code will not be flashed.
## Env var "jaiabot_systemd_type" can be set to one of: bot, hub, which will generate and enable the appropriate systemd services. If unset, the systemd services will not be installed and enabled
## 

set -e

botuser=jaia

function dockerPackageVersion() {
    docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t build_system apt show $1 | sed -n 's/^Version: \(.*\)~.*$/\1/p'
}

script_dir=$(dirname $0)

# install clang-format hook if not installed
[ ! -e ${script_dir}/../.git/hooks/pre-commit ] && ${script_dir}/../scripts/clang-format-hooks/git-pre-commit-format install

cd ${script_dir}/..
mkdir -p build/arm64

if [ "$(docker image ls build_system --format='true')" != "true" ];
then
    echo "🟢 Building the docker build_system image"
    docker build -t build_system .docker/focal/arm64
fi

# Get goby and dccl versions currently installed into the build image
docker_libgoby_version=$(dockerPackageVersion libgoby3)
docker_libdccl_version=$(dockerPackageVersion libdccl4)

echo "🟢 Building jaiabot apps"
docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t build_system bash -c "./scripts/arm64-build.sh"

# Remove old library files
echo "🟢 Cleaning old library files"
docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot/scripts -t build_system bash -c "./clean-lib-directory.py"

if [ -z "$1" ]
then
    echo "             -----------"
    echo "Not Deploying as you didn't specify any targets"
else
    for remote in "$@"
    do
        echo "🟢 Uploading to "$remote
        # Sync all directories except for lib
        rsync -za --force --relative --delete --exclude node_modules/ --exclude venv/ ./build/arm64/bin ./build/arm64/include ./build/arm64/share/ ./build/arm64/lib ./config ./scripts ${botuser}@"$remote":/home/${botuser}/jaiabot/
        # # Sync the lib directory with --delete flag, to keep it clean
        # rsync -za --force --relative --delete ./build/arm64/lib ${botuser}@"$remote":/home/${botuser}/jaiabot/

        # Login to the target, and deploy the software
        ssh ${botuser}@"${remote}" "jaiabot_systemd_type=${jaiabot_systemd_type} jaiabot_arduino_type=${jaiabot_arduino_type} docker_libgoby_version=${docker_libgoby_version} docker_libdccl_version=${docker_libdccl_version} bash -c ./jaiabot/scripts/arm64-deploy.sh"

        if [ ! -z $jaiabot_systemd_type ]; then
            echo "When you're ready, ssh ${botuser}@${hostname} and run 'sudo systemctl start jaiabot'"
        fi

    done
fi

