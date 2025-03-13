#!/bin/bash
set -e

apt-get install cloud-init -y

touch /boot/meta-data
touch /boot/user-data

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

cat -> /etc/cloud/cloud.cfg.d/99_fake_cloud.cfg <<'EOF'
# configure cloud-init for NoCloud
datasource_list: [ NoCloud, None ]
datasource:
  NoCloud:
    fs_label: bootfs
EOF

cat - > /etc/cloud/cloud.cfg.d/99_raspbian.cfg <<'EOF'
system_info:
  default_user:
    name: pi
    lock_passwd: false
    gecos: Raspbian
    groups: [pi adm dialout cdrom sudo audio video plugdev games users input netdev spi i2c gpio]
    sudo: ["ALL=(ALL) NOPASSWD: ALL"]
    shell: /bin/bash
  package_mirrors:
    - arches: [default]
      failsafe:
        primary: http://raspbian.raspberrypi.org/raspbian
        security: http://raspbian.raspberrypi.org/raspbian
EOF

# Disable dhcpcd - it has a conflict with cloud-init network config
systemctl mask dhcpcd