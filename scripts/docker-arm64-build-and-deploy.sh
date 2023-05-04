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
docker run --env JAIA_BUILD_NPROC -v `pwd`:/home/${botuser}/jaiabot -w /home/${botuser}/jaiabot -t build_system bash -c "./scripts/arm64-build.sh"

if [ -z "$1" ]
then
    echo "             -----------"
    echo "Not Deploying as you didn't specify any targets"
else
    for var in "$@"
    do
    	echo "🟢 Uploading to "$var
	rsync -zaP --force --relative --exclude node_modules/ ./src/web ./src/lib ./src/python ./build/arm64/bin ./build/arm64/lib ./build/arm64/include ./build/arm64/share/ ./config ./scripts ./src/arduino ${botuser}@"$var":/home/${botuser}/jaiabot/

        if [ ! -z "$jaiabot_systemd_type" ]; then
   	    echo "🟢 Installing and enabling systemd services (you can safely ignore bash 'Inappropriate ioctl for device' and 'no job control in this shell' errors)"
            ssh ${botuser}@"$var" "bash -c 'sudo apt-get -y remove jaiabot-embedded'"
            ssh ${botuser}@"$var" "bash -c 'cd /home/${botuser}/jaiabot/config/gen; ./systemd-local.sh ${jaiabot_systemd_type} --enable'"
            ssh ${botuser}@"$var" "bash -c 'sudo cp /home/${botuser}/jaiabot/scripts/75-jaiabot-status /etc/update-motd.d/'"
            ssh ${botuser}@"$var" "bash -c 'sudo cp /home/${botuser}/jaiabot/scripts/75-jaiabot-status /usr/local/bin/jaiabot-status'"
            ssh ${botuser}@"$var" "bash -c '/usr/bin/python3 -m venv /home/${botuser}/jaiabot/build/arm64/share/jaiabot/python/venv; source /home/${botuser}/jaiabot/build/arm64/share/jaiabot/python/venv/bin/activate; python3 -m pip install wheel; python3 -m pip install -r /usr/share/jaiabot/python/requirements.txt'"          
            ssh ${botuser}@"$var" "bash -c '/usr/bin/python3 -m venv /home/${botuser}/jaiabot/build/arm64/share/jaiabot/jdv/venv; source /home/${botuser}/jaiabot/build/arm64/share/jaiabot/jdv/venv/bin/activate; python3 -m pip install wheel; python3 -m pip install -r /home/${botuser}/jaiabot/build/arm64/share/jaiabot/jdv/requirements.txt'"          
        fi

    	echo "🟢 Creating and setting permissons on log dir"
        ssh ${botuser}@"$var" "sudo mkdir -p /var/log/jaiabot && sudo chown -R ${botuser}:${botuser} /var/log/jaiabot"
        
        if [ ! -z "$jaiabot_arduino_type" ]; then
            echo "🟢 Loading arduino type $jaiabot_arduino_type on "$var
            ssh ${botuser}@"$var" "sudo /home/${botuser}/jaiabot/build/arm64/share/jaiabot/arduino/jaiabot_runtime/$jaiabot_arduino_type/upload.sh"
        fi

        echo "When you're ready, ssh ${botuser}@${var} and run 'sudo systemctl start jaiabot'"
    done
fi

