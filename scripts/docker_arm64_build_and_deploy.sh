#!/bin/bash

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

        if [ ! -z "$jaiabot_arduino_type" ]; then
            echo "🟢 Loading arduino type $jaiabot_arduino_type on "$var
            ssh ubuntu@"$var" "/home/ubuntu/jaiabot/build/arm64/share/jaiabot/arduino/jaiabot_runtime/$jaiabot_arduino_type/upload.sh"
        fi
    done

    
fi

