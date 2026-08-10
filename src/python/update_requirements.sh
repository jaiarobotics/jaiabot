#!/bin/bash

# This script rewrites the requirements.txt file with all dependencies. It should be run whenever the dependencies for pyjaia changes

set -euo pipefail

script_dir=$(dirname $BASH_SOURCE)
set -a; source ${script_dir}/../../scripts/common-versions.env; set +a 

repo=${1:-"release"}
version=${jaia_version_release_branch}
distro=${jaia_version_ubuntu_codename}

echo "Using repo: $repo"

script_dir=$(dirname $0)

jaia_root=$(realpath ${script_dir}/../..)

sed -i 's/[~=]=/>=/' requirements.txt

docker run -w $(realpath ${script_dir}) -v ${jaia_root}:${jaia_root} -t gobysoft/jaiabot-ubuntu-amd64:26.04 \
       /bin/bash -c "set -euo pipefail; git config --global --add safe.directory ${jaia_root}; printf 'Types: deb\nURIs: http://packages.jaia.tech/ubuntu/${repo}/${version}/\nSuites: ${distro}/\nSigned-By: /etc/apt/keyrings/jaiabot.gpg\n' > /etc/apt/sources.list.d/jaiabot.sources; apt update && apt install -y rsync python3-dev python3-venv jaiabot-python; rm -rf /usr/share/jaiabot/python/venv; ./build_venv.sh /tmp/jaia; source /tmp/jaia/venv/bin/activate; pip3 freeze --local  > requirements.txt"

# correct dependencies that are included in jaiabot source
sed -i '/@ file:/d' requirements.txt
cat <<EOF >> requirements.txt
./pyjaia
./pyjaiaprotobuf
./Adafruit_CircuitPython_BNO08x
./jaia_serial
EOF
