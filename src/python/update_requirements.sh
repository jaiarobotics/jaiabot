#!/bin/bash

# This script rewrites the requirements.txt file with all dependencies (pip3 freeze --all). It should be run whenever the dependencies for pyjaia change.es

script_dir=$(dirname $0)

jaia_root=$(realpath ${script_dir}/../..)

sed -i 's/[~=]=/>=/' requirements.txt


docker run -w $(realpath ${script_dir}) -v ${jaia_root}:${jaia_root} -t gobysoft/jaiabot-ubuntu-amd64:24.04.1 \
       /bin/bash -c "apt update && apt install -y rsync python3-dev python3-venv; ./build_venv.sh /tmp/jaia; source /tmp/jaia/venv/bin/activate; pip3 freeze --all  > requirements.txt"


# from Ubuntu
sed -i '/=.*ubuntu.*/d' requirements.txt
sed -i '/gpg/d' requirements.txt

# local
sed -i '/pyjaia/d' requirements.txt
sed -i '/adafruit-circuitpython-bno08x/d' requirements.txt

cat <<EOF >> requirements.txt
./pyjaia
./Adafruit_CircuitPython_BNO08x
EOF
