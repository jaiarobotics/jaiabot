#!/bin/bash

version_group=$(grep -v '^#' /etc/apt/sources.list.d/jaiabot.list | grep -Eo 'continuous|beta|release' | tr '[:lower:]' '[:upper:]')

echo "The software group this system is following: $version_group"

installed_version=$(dpkg-query -W -f='${Version}' jaiabot-embedded)

echo "Installed version of jaiabot-embedded: $installed_version"

echo "Checking for updates..."

sudo apt update >/dev/null 2>&1

update_version=$(apt-cache policy jaiabot-embedded | grep -m1 "Candidate:" | awk '{print $2}')


if [[ "$installed_version" == "$update_version" ]]; then
    echo "No new version available to update"
else
    echo "Version available to update: ${update_version}"
fi

