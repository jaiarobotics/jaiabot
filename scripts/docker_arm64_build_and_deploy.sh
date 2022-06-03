#!/bin/bash


##
## Usage:
## jaiabot_arduino_type=usb_old jaiabot_systemd_type=bot ./docker_arm64_build_and_deploy.sh 172.20.11.102
##
## Command line arguments is a list of Jaiabots to push deployed code to.
## If omitted, the code is just built, but not pushed
## Env var "jaiabot_arduino_type" can be set to one of: usb_old, usb_new, spi which will upload the arduino code (jaiabot_runtime) based on the connection type. If unset, the arduino code will not be flashed.
## Env var "jaiabot_systemd_type" can be set to one of: bot, hub, which will generate and enable the appropriate systemd services. If unset, the systemd services will not be installed and enabled
## 

set -e

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
docker run -v `pwd`:/home/ubuntu/jaiabot -w /home/ubuntu/jaiabot -t build_system bash -c "./scripts/arm64_build.sh"

if [ -z "$1" ]
then
    echo "             -----------"
    echo "Not Deploying as you didn't specify any targets"
else
    for var in "$@"
    do
    	echo "🟢 Uploading to "$var
	rsync -zaP --delete --force --relative --exclude './src/web/node_modules' ./src/web/dist ./src/web ./src/lib ./src/python ./build/arm64/bin ./build/arm64/lib ./build/arm64/include ./build/arm64/share/ ./config ./scripts ./src/arduino ubuntu@"$var":/home/ubuntu/jaiabot/

        if [ ! -z "$jaiabot_systemd_type" ]; then
   	    echo "🟢 Installing and enabling systemd services"
            ssh ubuntu@"$var" "bash -c 'cd /home/ubuntu/jaiabot/config/gen; ./systemd-local.sh ${jaiabot_systemd_type} --enable'"
        fi

    	echo "🟢 Creating and setting permissons on log dir"
        ssh ubuntu@"$var" "sudo mkdir -p /var/log/jaiabot && sudo chown -R ubuntu:ubuntu /var/log/jaiabot"
        
        if [ ! -z "$jaiabot_arduino_type" ]; then
            echo "🟢 Loading arduino type $jaiabot_arduino_type on "$var
            ssh ubuntu@"$var" "/home/ubuntu/jaiabot/build/arm64/share/jaiabot/arduino/jaiabot_runtime/$jaiabot_arduino_type/upload.sh"
        fi

        echo "When you're ready, ssh ubuntu@${var} and run 'sudo systemctl start jaiabot'"
    done
fi

