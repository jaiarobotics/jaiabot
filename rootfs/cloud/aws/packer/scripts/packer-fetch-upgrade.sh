#!/bin/bash

set -u -e 

upgrade_dir=/opt/upgrade
sudo mkdir -p ${upgrade_dir}
sudo chown $USER ${upgrade_dir}

url_base=https://jaia-disk-images.s3.${AWS_REGION}.amazonaws.com/${JAIA_UPGRADE_REPO}/${JAIA_UPGRADE_VERSION}/vbox
wget ${url_base}/version.txt -O ${upgrade_dir}/version.txt

set -a; source ${upgrade_dir}/version.txt; set +a

iso_name_url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${iso_name}'))")

wget ${url_base}/${iso_name_url} -O ${upgrade_dir}/update.iso --progress=dot:giga
sudo mount ${upgrade_dir}/update.iso /mnt
