#!/bin/bash

# This script is executed on the remote hub/bot, when using the docker-arm64-build-and-deploy.sh script

build_dir=$1

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
pushd ${HOME}/jaiabot/${build_dir}/share/jaiabot/python
    /usr/bin/python3 -m venv venv/ --system-site-packages
    source venv/bin/activate
    # /tmp does not necessarily have enough space on the embedded boards, but /var/log is large
    python3 -m pip -q install wheel
    python3 -m pip install -q -r requirements.txt

    # The local packages carry a fixed version (e.g. pyjaia 1.0.0) that never changes, so pip
    # cannot tell when their contents change and may leave stale or partially-written files
    # behind. Reinstall them explicitly so a deploy always lands the code we just built.
    local_pkgs=$(grep '^\./' requirements.txt)
    if [ -n "${local_pkgs}" ]; then
        echo "🟢 Reinstalling local python packages: $(echo ${local_pkgs} | tr '\n' ' ')"
        python3 -m pip install -q --force-reinstall --no-deps --no-cache-dir ${local_pkgs}
    fi
popd

jaiabot_version=$(cat ${HOME}/jaiabot/${build_dir}/share/version.txt)

source /etc/jaiabot/runtime.env

jaia_simulation=
if [[ "$jaia_mode" == "simulation" ]]; then
    jaia_simulation="--simulation --warp ${jaia_warp}"
fi

echo "🟢 Creating and setting permissions on log dir"
sudo mkdir -p /var/log/jaiabot/bot_offload && sudo chown -R ${USER}:${USER} /var/log/jaiabot

if [ ! -z "$jaiabot_systemd_type" ]; then
    echo "🟢 Installing and enabling $jaiabot_systemd_type systemd services (you can safely ignore bash 'Inappropriate ioctl for device' and 'no job control in this shell' errors)"

    if [[ "$jaiabot_systemd_type" == *"bot"* ]]; then
        cd ${HOME}/jaiabot/config/gen
        (set -x; export PATH=${HOME}/jaiabot/${build_dir}/bin:$PATH;
        ./systemd-local.sh ${jaiabot_systemd_type} --bot_index $jaia_bot_index --fleet_index $jaia_fleet_index --electronics_stack $jaia_electronics_stack --imu_type $jaia_imu_type --imu_install_type $jaia_imu_install_type --arduino_type $jaia_arduino_type --bot_type ${jaia_bot_type,,} --bot_vin "$jaia_bot_vin" --pam_connection_type ${jaia_pam_connection_type,,} --temperature_sensor_type ${jaia_temperature_sensor_type,,} --pressure_sensor_type ${jaia_pressure_sensor_type,,} $jaia_simulation --enable --motor_harness_type ${jaia_motor_harness_type,,} --camera_positions ${jaia_camera_positions,,} --additional_sensors ${jaia_additional_sensors}) || { echo "❌ Failed to install the $jaiabot_systemd_type systemd services, so this deploy is still running the previously installed code"; exit 1; }

    else

        cd ${HOME}/jaiabot/config/gen
        (set -x; export PATH=${HOME}/jaiabot/${build_dir}/bin:$PATH;
         ./systemd-local.sh ${jaiabot_systemd_type} --hub_index $jaia_hub_index --fleet_index $jaia_fleet_index --electronics_stack $jaia_electronics_stack --led_type hub_led $jaia_simulation --enable --user_role advanced) || { echo "❌ Failed to install the $jaiabot_systemd_type systemd services, so this deploy is still running the previously installed code"; exit 1; }

        sudo chmod o+x ${HOME}
        sudo a2ensite jcc

        # mod_wsgi daemon processes are long-lived and keep the previously imported python
        # modules in memory, so they must be restarted to pick up the venv we just updated.
        echo "🟢 Restarting apache2 to reload the updated python code"
        sudo systemctl restart apache2
    fi

fi

sudo cp ${HOME}/jaiabot/scripts/75-jaiabot-status /etc/update-motd.d/
# use symlink so this gets updated if the user re-installs the packaged version
sudo ln -s -f /etc/update-motd.d/75-jaiabot-status /usr/local/bin/jaiabot-status

echo "Arduino Type: $jaia_arduino_type"

if [ "$jaia_arduino_type" != "none" ]; then
    echo "🟢 Loading arduino type $jaia_arduino_type on $HOSTNAME"
    sudo ${HOME}/jaiabot/${build_dir}/share/jaiabot/arduino/jaiabot_runtime/$jaia_arduino_type/upload.sh
fi

# Check for STM32 deploy scripts (one per sketch, e.g. bio_payload, power_board)
for stm32_upload in ${HOME}/jaiabot/${build_dir}/share/jaiabot/stm32/*/uart/upload.sh; do
    if [ -f "${stm32_upload}" ]; then
        echo "🟢 STM32 firmware deployment script found at:"
        echo "   ${stm32_upload}"
        echo "   Run it manually on the vehicle when ready to flash the STM32 board:"
        echo "   bash ${stm32_upload}"
    fi
done

sudo sh -c "echo 'Development version: ${jaiabot_version}, deployed $(date)' > /etc/jaiabot/software_version"
