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

##################################################
## Enable /dev/ttyAMA0, remove serial console   ##
##################################################
cat <<EOF >> /boot/config.txt
enable_uart=1
EOF
sed -i 's|console=serial0,115200||' /boot/cmdline.txt

######################
## Set default user ##
######################

# some random password no one knows
# tr -dc A-Za-z0-9 </dev/urandom | head -c 60 | openssl passwd -6 -stdin
echo 'pi:$6$1y4De4OszU.GCvZy$k/FX53tHxo.JIa5reFBWxRgo4/mT78VRJ1TCWlumPFTqFfdWAW/koXGzcwW58GLMJu3ypxadQEctX4aZs2pNt1' > /boot/userconf.txt

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

cat <<EOF > /boot/jaiabot/init/first-boot.preseed.yml.j2
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
{%- for pk in ssh.permanentAuthorizedKeys %}
      - "{{ pk }}"
{%- endfor %}

write_files:
  - path: /etc/systemd/network/10-wlan0-fleet.network
    content: |
      [Match]
      Name=wlan0
      SSID="JAIA-HUB-WIFI-{{ fleet }}"
      
      [Network]
      Address={{ this.ip }}
      Gateway={{ this.gateway_ip }}
      DNS=1.1.1.1
      DNS=8.8.8.8
  - path: /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
    content: |
      ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
      update_config=1
      country=US
      
      network={
          ssid="JAIA-HUB-WIFI-{{ fleet }}"
          psk="{{ wlanPassword }}"
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
