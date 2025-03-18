#!/bin/bash
set -e

#############################
## Install Camera packages ##
#############################
apt-get -y update && apt-get -y install libcamera-apps libcamera-dev python3-libcamera

#############################
## Install other packages ##
#############################
apt-get -y update && apt-get -y install zile openssh-server
ln -s /usr/bin/zile /usr/local/bin/emacs

###########################
## Enable serial console ##
###########################

cat <<EOF >> /boot/config.txt
enable_uart=1
EOF

######################
## Set default user ##
######################

echo 'pi:$6$iUNuooIaXkM8jgfN$AwoQhINZrpy7gHefuEu.lsksUzUgue5P8uLDRo5LO04f.xpOpsG6jOKWzG2XmGLc/foNAq0uwcv/I4WM3ChJ40' > /boot/userconf.txt

#########################
## Use systemd-network ##
## not network manager ##
#########################

apt-get -y remove network-manager
systemctl enable systemd-networkd
systemctl mask systemd-networkd-wait-online.service

#########################
## Install first boot ##
#########################

cat <<EOF > /boot/jaiabot/init/first-boot.preseed.yml
#cloud-config

ssh_pwauth: false

bootcmd:
  - rfkill unblock wifi

users:
  - name: jaia
    groups: users,adm,dialout,audio,netdev,video,plugdev,cdrom,games,input,gpio,spi,i2c,render,sudo
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    lock_passwd: true
    ssh_authorized_keys:
      - "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCyo/c0BMJpE8bzwOQk15xBn3fUhk6Gg8xqIH+ZATw8z3IaYH/5UYeCi8wjwjI1gF61zFlr0BSBuRctNRr1+P88sdeyDAinnplhBXAWBKm5aaC1gjM+IPI6LB8RytxOSMp/w/MRn6meeEsMkIr6+v2qAhBY6vtUObHTu1JE2gB+Cckq0zHdhtUb/tm063i3DfsAaftEAZLzwGS1Ad3jBe+bhydAUSPYxc7njF+meHJTqyzg1Cc9C0hb8bfsOG+LZF/+ap60UaM49ko2MTulvwKABzN5l9vvS4d5RycnkTwIGoY984TB/DrMc6HEqxooz51T4+7ltlgQ+VacgU0xE1f/ toby@aubergine"


write_files:
  - path: /etc/systemd/network/10-wlan0-fleet.network
    content: |
      [Match]
      Name=wlan0
      SSID="JAIA-HUB-WIFI-5"
      
      [Network]
      Address=10.23.5.151
      Gateway=10.23.5.1
      DNS=1.1.1.1
      DNS=8.8.8.8
  - path: /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
    content: |
      ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
      update_config=1
      country=US
      
      network={
          ssid="JAIA-HUB-WIFI-5"
          psk="firefish(9000)"
          id_str="fleet_wifi"
          priority=2
      }

runcmd:
  - systemctl enable wpa_supplicant@wlan0
  - systemctl enable ssh


mounts:
  - [ "LABEL=data", "/var/log/jaiabot", "auto",  "defaults,nofail,x-systemd.device-timeout=30", "0", "1" ]

power_state:
  mode: reboot
  timeout: 30
  condition: true


EOF
