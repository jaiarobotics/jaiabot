#!/bin/bash

set -u -e 

upgrade_dir=/opt/upgrade
sudo mkdir -p ${upgrade_dir}
sudo chown $USER ${upgrade_dir}

source=${1:-s3}

function print_usage() {
    echo "Usage: $0 [s3|local] [/path/to/local/dir (if local)]"
}

if [ "$source" == "s3" ]; then
    url_base=https://jaia-disk-images.s3.us-east-1.amazonaws.com/${JAIA_UPGRADE_REPO}/${JAIA_UPGRADE_VERSION}/vbox
elif [ "$source" == "local" ]; then
    if [ "$2" == ""]; then
        echo "Invalid directory to local iso file"
        print_usage
        exit 1
    fi
    url_base="file://${2}"
else
    echo "Invalid source type; options are 'local' or 's3'"
    print_usage
    exit 1
fi

curl ${url_base}/version.txt -o ${upgrade_dir}/version.txt

set -a; source ${upgrade_dir}/version.txt; set +a

iso_name_url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${iso_name}'))")

curl ${url_base}/${iso_name_url} -o ${upgrade_dir}/update.iso
sudo mount ${upgrade_dir}/update.iso /mnt
