#!/bin/bash


##
## Usage:
## jaiabot_arduino_type=usb_old ./docker_arm64_build_and_deploy.sh 172.20.11.102
##
## Command line arguments is a list of Jaiabots to push deployed code to.
## If omitted, the code is just built, but not pushed
## Env var "jaiabot_arduino_type" can be set to one of: usb_old, usb_new, spi which will upload the arduino code (jaiabot_runtime) based on the connection type. If unset, the arduino code will not be flashed.
## 

set -e

script_dir=$(dirname $0)

cd ${script_dir}/..
mkdir -p build/arm64

if [ "$(docker image ls build_system --format='true')" != "true" ];
then
    echo "🟢 Building the docker build_system image"
    docker build -t build_system .docker/focal/arm64
fi

echo "🟢 Building jaiabot apps"
docker run -v `pwd`:/home/ubuntu/jaiabot -w /home/ubuntu/jaiabot -t build_system bash -c "./scripts/arm64_build.sh"

if [ -z "$1" ]
then
    echo "             -----------"
    echo "Not Deploying as you didn't specify any targets"
else
    for var in "$@"
    do
    	echo "🟢 Uploading to "$var
	rsync -zaP --delete --force --relative ./src/python ./build/arm64/bin ./build/arm64/lib ./build/arm64/include ./build/arm64/share/ ./config ./scripts ./src/arduino ubuntu@"$var":/home/ubuntu/jaiabot/

    	echo "🟢 Installing and enabling systemd services"
        ssh ubuntu@"$var" "bash -c 'cd /home/ubuntu/jaiabot/config/gen; ./systemd-local.sh bot --enable'"
        
        if [ ! -z "$jaiabot_arduino_type" ]; then
            echo "🟢 Loading arduino type $jaiabot_arduino_type on "$var
            ssh ubuntu@"$var" "/home/ubuntu/jaiabot/build/arm64/share/jaiabot/arduino/jaiabot_runtime/$jaiabot_arduino_type/upload.sh"
        fi
    done

    
fi

