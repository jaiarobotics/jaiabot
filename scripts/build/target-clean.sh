#!/bin/bash

# This script is executed on the remote hub/bot to undo a from-source deploy, leaving the machine
# running the packaged install. It is piped in over ssh by container-build-and-deploy.sh rather
# than run from ~/jaiabot, since it removes that directory.

set -e

jaia_dir=${HOME}/jaiabot
packaged_gen_dir=/usr/share/jaiabot/config/gen

if ! dpkg-query -W -f='${Status}' jaiabot-embedded 2>/dev/null | grep -q "install ok installed"; then
    echo "❌ jaiabot-embedded is not installed here, so there is no packaged install to revert to."
    exit 1
fi

echo "🟢 Stopping jaiabot services"
sudo systemctl stop jaiabot || true

# The from-source deploy writes its units to /etc/systemd/system, which take precedence over the
# packaged units in /usr/lib/systemd/system. Ask the packaged generator which unit names exist so
# only those are removed, leaving any unit added by hand alone.
echo "🟢 Removing the systemd services generated from source"
unit_names=$(mktemp -d)
sudo ${packaged_gen_dir}/systemd.py --systemd_dir="${unit_names}" > /dev/null
shopt -s nullglob # an empty directory must not turn the path below into a glob
for unit in "${unit_names}"/*; do
    sudo rm -f "/etc/systemd/system/$(basename "${unit}")"
done
sudo rm -rf "${unit_names}"

# postinst regenerates and enables the packaged units, restores the jcc apache site and rewrites
# /etc/jaiabot/software_version, so it defines what "the packaged install" is
echo "🟢 Restoring the packaged configuration"
sudo dpkg-reconfigure -f noninteractive jaiabot-embedded

# shadows the packaged /usr/bin/jaiabot-status
sudo rm -f /usr/local/bin/jaiabot-status

echo "🟢 Removing ${jaia_dir}"
rm -rf "${jaia_dir}"

echo "✅ Reverted to the packaged install: $(cat /etc/jaiabot/software_version 2>/dev/null)"
echo "   Log data in /var/log/jaiabot was left alone."
echo "   When you're ready, run 'sudo systemctl start jaiabot'"
