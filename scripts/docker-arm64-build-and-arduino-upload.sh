#!/usr/bin/env bash

##
## Usage:
## jaiabot_arduino_type=usb_old ./docker-arm64-build-and-deploy.sh 172.20.11.102
##
## Command line arguments is a list of Jaiabots to push deployed code to.
## If omitted, the code is just built, but not pushed
## Env var "jaiabot_arduino_type" can be set to one of: usb_old, usb_new, spi which will upload the arduino code (jaiabot_runtime) based on the connection type. If unset, the arduino code will not be flashed.

set -e

botuser=jaia

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

echo "🟢 Building jaiabot apps"
docker run -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t build_system bash -c "./scripts/arm64-build.sh"

if [ -z "$1" ]
then
    echo "             -----------"
    echo "Not Deploying as you didn't specify any targets"
else
    for var in "$@"
    do
    	echo "🟢 Uploading to "$var
	rsync -zaP --delete --force --relative ./build/arm64/share/jaiabot/arduino ${botuser}@"$var":/home/${botuser}/jaiabot/
        
        if [ ! -z "$jaiabot_arduino_type" ]; then
            echo "🟢 Loading arduino type $jaiabot_arduino_type on "$var
            ssh ${botuser}@"$var" "/home/${botuser}/jaiabot/build/arm64/share/jaiabot/arduino/jaiabot_runtime/$jaiabot_arduino_type/upload.sh"
        fi

        echo "Finished Arduino Upload"
    done
fi

