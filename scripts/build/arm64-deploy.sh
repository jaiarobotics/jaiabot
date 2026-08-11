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
popd

jaiabot_version=$(cat ${HOME}/jaiabot/${build_dir}/share/version.txt)

# generated per target by docker-arm64-build-and-deploy.sh and rsynced with the build
selections=${HOME}/jaiabot/${build_dir}/jaiabot-embedded.selections

if [ ! -z "$jaiabot_systemd_type" ] && [ ! -f "${selections}" ]; then
    echo "❌ ${selections} not found. Deploy via docker-arm64-build-and-deploy.sh, which generates it."
    exit 1
fi

echo "🟢 Creating and setting permissions on log dir"
sudo mkdir -p /var/log/jaiabot/bot_offload && sudo chown -R ${USER}:${USER} /var/log/jaiabot

if [ ! -z "$jaiabot_systemd_type" ]; then
    echo "🟢 Installing and enabling $jaiabot_systemd_type systemd services"

    cd ${HOME}/jaiabot/config/gen
    (set -x; export PATH=${HOME}/jaiabot/${build_dir}/bin:$PATH;
     ./systemd-local.sh --debconf_selections ${selections} --enable)

    if [[ "$jaiabot_systemd_type" != *"bot"* ]]; then
        sudo chmod o+x ${HOME}
        sudo a2ensite jcc
    fi

fi

sudo cp ${HOME}/jaiabot/src/sh/system/75-jaiabot-status /etc/update-motd.d/
# use symlink so this gets updated if the user re-installs the packaged version
sudo ln -s -f /etc/update-motd.d/75-jaiabot-status /usr/local/bin/jaiabot-status

echo "Arduino Type: $jaia_arduino_type"

if [ "$jaia_arduino_type" != "none" ]; then
    echo "🟢 Loading arduino type $jaia_arduino_type on $HOSTNAME"
    sudo ${HOME}/jaiabot/${build_dir}/share/jaiabot/arduino/jaiabot_runtime/$jaia_arduino_type/upload.sh
fi

sudo sh -c "echo 'Development version: ${jaiabot_version}, deployed $(date)' > /etc/jaiabot/software_version"
