#!/bin/bash

# This script is executed on the remote hub/bot, when using the container-build-and-deploy.sh script

set -e

build_dir=$1
jaia_dir=${HOME}/jaiabot

package_version() { dpkg-query -W -f='${Version}' "$1" | sed 's/~.*//'; }

echo "🟢 Verifying goby and dccl versions match"
local_libgoby_version=$(package_version libgoby3)
local_libdccl_version=$(package_version libdccl5)
echo "Local  versions: ${local_libdccl_version} ${local_libgoby_version}"
echo "Docker versions: ${docker_libdccl_version} ${docker_libgoby_version}"

if [[ ${local_libdccl_version} == ${docker_libdccl_version} && ${local_libgoby_version} == ${docker_libgoby_version} ]]; then
    echo "✅ They match"
else
    echo "❌ Mismatch!  Try running the docker-build-build-system.sh script."
    exit 1
fi

# generated per target by container-build-and-deploy.sh and rsynced with the build
selections=${jaia_dir}/${build_dir}/jaiabot-embedded.selections

if [ ! -f "${selections}" ]; then
    echo "❌ ${selections} not found. Deploy via container-build-and-deploy.sh, which generates it."
    exit 1
fi

debconf_answer() { awk -v question="jaiabot-embedded/$1" '$2 == question { print $4 }' "${selections}"; }

echo "🟢 Creating python virtual environment (venv)"
(
    cd ${jaia_dir}/${build_dir}/share/jaiabot/python
    /usr/bin/python3 -m venv venv/ --system-site-packages
    source venv/bin/activate
    python3 -m pip install -q wheel
    python3 -m pip install -q -r requirements.txt
)

echo "🟢 Creating and setting permissions on log dir"
sudo mkdir -p /var/log/jaiabot/bot_offload && sudo chown -R ${USER}:${USER} /var/log/jaiabot

jaia_type=$(debconf_answer type)
if [ -z "${jaia_type}" ]; then
    echo "❌ No 'jaiabot-embedded/type' answer in ${selections}, so the systemd services to install are unknown."
    exit 1
fi

echo "🟢 Installing and enabling ${jaia_type} systemd services"
(
    cd ${jaia_dir}/config/gen
    set -x
    export PATH=${jaia_dir}/${build_dir}/bin:$PATH
    ./systemd-local.sh --debconf_selections ${selections} --enable
)

if [ "${jaia_type}" != "bot" ]; then
    sudo chmod o+x ${HOME}
    sudo a2ensite jcc
fi

sudo cp ${jaia_dir}/src/sh/system/75-jaiabot-status /etc/update-motd.d/
# use symlink so this gets updated if the user re-installs the packaged version
sudo ln -s -f /etc/update-motd.d/75-jaiabot-status /usr/local/bin/jaiabot-status

jaia_arduino_type=$(debconf_answer arduino_type)
# unanswered questions use the same default as systemd.py
jaia_arduino_type=${jaia_arduino_type:-none}
echo "Arduino Type: ${jaia_arduino_type}"

if [ "${jaia_arduino_type}" != "none" ]; then
    echo "🟢 Loading arduino type ${jaia_arduino_type} on ${HOSTNAME}"
    sudo ${jaia_dir}/${build_dir}/share/jaiabot/arduino/jaiabot_runtime/${jaia_arduino_type}/upload.sh
fi

jaiabot_version=$(cat ${jaia_dir}/${build_dir}/share/version.txt)
sudo sh -c "echo 'Development version: ${jaiabot_version}, deployed $(date)' > /etc/jaiabot/software_version"
