#!/bin/bash

# This script is executed on the remote hub/bot, when using the docker-arm64-build-and-deploy.sh script

echo "🟢 Verifying goby and dccl versions match"
local_libgoby_version=$(apt show libgoby3 | sed -n 's/^Version: \(.*\)~.*$/\1/p')
local_libdccl_version=$(apt show libdccl4 | sed -n 's/^Version: \(.*\)~.*$/\1/p')
echo Local  versions: ${local_libdccl_version} ${local_libgoby_version}
echo Docker versions: ${docker_libdccl_version} ${docker_libgoby_version}

if [[ ${local_libdccl_version} == ${docker_libdccl_version} && ${local_libgoby_version} == ${docker_libgoby_version} ]]; then
    echo "✅ They match"
else
    echo "❌ Mismatch!  Try running the docker-build-build-system.sh script."
    exit 1
fi

echo "🟢 Creating python virtual environment (venv)"
pushd ${HOME}/jaiabot/build/arm64/share/jaiabot/python
    /usr/bin/python3 -m venv venv/
    source venv/bin/activate
    python3 -m pip -q install wheel
    python3 -m pip install -q -r requirements.txt
popd

sudo apt-get -qq -y remove "*jaiabot*"

jaiabot_version=$(cat ${HOME}/jaiabot/build/arm64/share/version.txt)

source /etc/jaiabot/runtime.env

echo "🟢 Creating and setting permissons on log dir"
sudo mkdir -p /var/log/jaiabot/bot_offload && sudo chown -R ${USER}:${USER} /var/log/jaiabot

if [ ! -z "$jaiabot_systemd_type" ]; then
    echo "🟢 Installing and enabling $jaiabot_systemd_type systemd services (you can safely ignore bash 'Inappropriate ioctl for device' and 'no job control in this shell' errors)"

    if [[ "$jaiabot_systemd_type" == *"bot"* ]]; then

        cd ${HOME}/jaiabot/config/gen
        ./systemd-local.sh ${jaiabot_systemd_type} --bot_index $jaia_bot_index --fleet_index $jaia_fleet_index --electronics_stack $jaia_electronics_stack --imu_type $jaia_imu_type --arduino_type $jaia_arduino_type --bot_type ${jaia_bot_type,,} --enable

    else

        cd ${HOME}/jaiabot/config/gen
        ./systemd-local.sh ${jaiabot_systemd_type} --hub_index $jaia_hub_index --fleet_index $jaia_fleet_index --electronics_stack $jaia_electronics_stack --led_type hub_led --enable --user_role advanced

    fi

fi

sudo cp ${HOME}/jaiabot/scripts/75-jaiabot-status /etc/update-motd.d/

sudo cp ${HOME}/jaiabot/scripts/75-jaiabot-status /usr/local/bin/jaiabot-status

if [ ! -z "$jaiabot_arduino_type" ]; then
    echo "🟢 Loading arduino type $jaiabot_arduino_type on $HOSTNAME"
    sudo ${HOME}/jaiabot/build/arm64/share/jaiabot/arduino/jaiabot_runtime/$jaiabot_arduino_type/upload.sh
fi

sudo sh -c "echo 'Development version: ${jaiabot_version}, deployed $(date)' > /etc/jaiabot/software_version"
