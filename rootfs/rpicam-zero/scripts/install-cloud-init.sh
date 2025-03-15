#!/bin/bash
set -e


########################
## Install cloud-init ##
########################

apt-get -y update && apt-get install cloud-init -y

mkdir -p /boot/jaiabot/init/
touch /boot/jaiabot/init/meta-data

cat - > /boot/jaiabot/init/user-data <<EOF
#include
file:///boot/firmware/jaiabot/init/first-boot.preseed.yml
EOF

cat - > /etc/cloud/templates/sources.list.debian.tmpl <<'EOF'
## template:jinja
## Note, this file is written by cloud-init on first boot of an instance
## modifications made here will not survive a re-bundle.
## if you wish to make changes you can:
## a.) add 'apt_preserve_sources_list: true' to /etc/cloud/cloud.cfg
##     or do the same in user-data
## b.) add sources in /etc/apt/sources.list.d
## c.) make changes to template file /etc/cloud/templates/sources.list.debian.tmpl
###

deb {{mirror}} {{codename}} main contrib non-free rpi
deb-src {{mirror}} {{codename}} main contrib non-free rpi
EOF

cat - > /etc/cloud/cloud.cfg.d/99_fake_cloud.cfg <<'EOF'
# configure cloud-init for NoCloud
datasource_list: [ NoCloud, None ]
datasource:
  NoCloud:
    seedfrom: file:///boot/firmware/jaiabot/init/
EOF

cat - > /etc/cloud/cloud.cfg.d/99_raspbian.cfg <<'EOF'
system_info:
  package_mirrors:
    - arches: [default]
      failsafe:
        primary: http://raspbian.raspberrypi.org/raspbian
        security: http://raspbian.raspberrypi.org/raspbian
EOF

# Disable dhcpcd - it has a conflict with cloud-init network config
systemctl mask dhcpcd
