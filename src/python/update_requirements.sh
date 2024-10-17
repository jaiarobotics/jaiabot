#!/bin/bash

# This script rewrites the requirements.txt file with all dependencies. It should be run whenever the dependencies for pyjaia changes

repo=${1:-"release"}

echo "Using repo: $repo"

script_dir=$(dirname $0)

jaia_root=$(realpath ${script_dir}/../..)

sed -i 's/[~=]=/>=/' requirements.txt

docker run -w $(realpath ${script_dir}) -v ${jaia_root}:${jaia_root} -t gobysoft/jaiabot-ubuntu-amd64:24.04.1 \
       /bin/bash -c "sed -i \"s/release/${repo}/\" /etc/apt/sources.list.d/jaiabot*.list; apt update && apt install -y rsync python3-dev python3-venv jaiabot-python; rm -rf /usr/share/jaiabot/python/venv; ./build_venv.sh /tmp/jaia; source /tmp/jaia/venv/bin/activate; pip3 freeze --local  > requirements.txt"

# correct dependencies that are included in jaiabot source
sed -i '/@ file:/d' requirements.txt
cat <<EOF >> requirements.txt
./pyjaia
./pyjaiaprotobuf
./Adafruit_CircuitPython_BNO08x
EOF
