#!/bin/bash
set -e -u

# 
# This script configures the new image. It should only be run once 
# on first boot
# 

USING_PRESEED=false
if [ -e /boot/firmware/jaiabot/init/first-boot.preseed ]; then
   USING_PRESEED=true
   source /boot/firmware/jaiabot/init/first-boot.preseed
fi

source /etc/jaiabot/init/include/wt_tools.sh

if [ ! "$UID" -eq 0 ]; then 
    echo "This script must be run as root" >&2
    exit 1;
fi

echo "###########################################"
echo "###########################################"
echo "##### jaiabot first boot init script ######"
echo "###########################################"
echo "###########################################"

source /etc/jaiabot/version
run_wt_yesno jaia_run_first_boot "JaiaBot First Boot" "Image Version: $JAIABOT_IMAGE_VERSION.\nThis is the first boot of the machine since this image was written.\n\nDo you want to run the first-boot setup (RECOMMENDED)?" || exit 0

echo "######################################################"
echo "## Set Password                                     ##"
echo "######################################################"

random_pw=$(openssl rand -base64 30)
run_wt_password random_pw "Password" "Enter a new password for jaia"
[ $? -eq 0 ] || exit 1
echo "jaia:$WT_PASSWORD" | chpasswd

echo "######################################################"
echo "## Disallow password login on SSH                   ##"
echo "######################################################"

cp /etc/ssh/sshd_config /etc/ssh/sshd_config~
sed -i 's/^[# ]*PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config

echo "###############################################"
echo "## Resizing data partition to fill disk      ##"
echo "###############################################"

JAIABOT_DATA_PARTITION=$(realpath /dev/disk/by-label/data)
JAIABOT_DATA_DISK="/dev/$(lsblk ${JAIABOT_DATA_PARTITION} -n -s -o NAME -l | tail -1)"
JAIABOT_DATA_PARTITION_NUMBER=${JAIABOT_DATA_PARTITION:(-1)}
JAIABOT_DATA_MOUNTPOINT="/var/log"

echo -e "\nResizing partition $JAIABOT_DATA_PARTITION_NUMBER of: $JAIABOT_DATA_DISK\n"
(set -x; growpart $JAIABOT_DATA_DISK $JAIABOT_DATA_PARTITION_NUMBER || [ $? -lt 2 ])

echo -e "\nResizing filesystem: $JAIABOT_DATA_PARTITION\n"
# btrfs filesystem resize requires mount point as the argument
(set -x; btrfs filesystem resize max $JAIABOT_DATA_MOUNTPOINT)

mkdir -p /var/log/jaiabot
# allow jaia user to write logs
chown -R jaia:jaia /var/log/jaiabot

mkdir -p /var/log/apache2

echo "###############################################################"
echo "## Stress Tests                                              ##" 
echo "###############################################################"

run_wt_yesno jaia_stress_tests "Hardware checks and stress test" \
             "Do you want to run the hardware checks and stress test?" && source /etc/jaiabot/init/board-check.sh

echo "###############################################"
echo "## Setting up i2c                            ##"
echo "###############################################"

if [ -e /dev/i2c-1 ]; then
    groupadd -f i2c
    chown :i2c /dev/i2c-1
    chmod g+rw /dev/i2c-1
    usermod -aG i2c jaia
    udev_entry='KERNEL=="i2c-[0-9]*", GROUP="i2c"'
    grep "$udev_entry" /etc/udev/rules.d/10-local_i2c_group.rules || echo "$udev_entry" >> /etc/udev/rules.d/10-local_i2c_group.rules
else
    echo "Warning: no /dev/i2c-1 found so not configuring (this is OK if running in Virtualbox)"
fi

echo "###############################################"
echo "## Setting up wifi                           ##"
echo "###############################################"

run_wt_yesno jaia_disable_ethernet "Wired ethernet (eth0)" \
             "Do you want to disable the wired Ethernet interface (eth0)?" && cat <<EOF >> /etc/systemd/network/30-eth0.network
[Link]
ActivationPolicy=manual
EOF

run_wt_yesno jaia_configure_wifi "Wireless ethernet (wlan0)" \
             "Do you want to configure the wireless Ethernet interface (wlan0)?" &&
(
run_wt_inputbox jaia_wifi_ssid "wlan0 SSID" \
            "Enter wlan0 SSID"
wlan_ssid=${WT_TEXT}

run_wt_inputbox jaia_wifi_password "SSID Password" \
                "Enter the password for SSID ${wlan_ssid}"
wlan_password=${WT_TEXT}

# IP addresses will be overwritten by jaiabot-embedded after choice of hub/bot info
cat << EOF > /etc/systemd/network/20-wlan0-fleet.network
[Match]
Name=wlan0
SSID=${wlan_ssid}

[Network]
Address=10.23.XXX.YYY/24
Gateway=10.23.XXX.1
DNS=1.1.1.1
EOF

sed -i "s/ssid=\"_JAIA_ESSID_\"/ssid=\"${wlan_ssid}\"/" /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
sed -i "s/psk=\"_JAIA_WPA_PSK_\"/ssid=\"${wlan_password}\"/" /etc/wpa_supplicant/wpa_supplicant-wlan0.conf


# for real ethernet acting as wlan0 (VirtualBox)
if [[ "${wlan_ssid}" = "" || "${wlan_ssid}" = "dummy" ]]; then
    sed -i 's/\(.*SSID=.*\)/# \1/' /etc/systemd/network/20-wlan0-fleet.network
else
    systemctl enable wpa_supplicant@wlan0
fi
)

echo "###############################################"
echo "## Disable getty on /dev/ttyS0               ##"
echo "###############################################"

systemctl stop serial-getty@ttyS0.service
systemctl disable serial-getty@ttyS0.service

echo "###############################################"
echo "## Setting up device links                   ##"
echo "###############################################"

# for backwards compatibility, remove once we've updated all bots to rootfs-gen filesystem
mkdir -p /etc/jaiabot/dev
ln -s -f /dev/gps0 /etc/jaiabot/dev/gps
ln -s -f /dev/arduino /etc/jaiabot/dev/arduino
ln -s -f /dev/xbee /etc/jaiabot/dev/xbee

echo "###############################################"
echo "## Install jaiabot-embedded package          ##"
echo "###############################################"

run_wt_yesno jaia_install_jaiabot_embedded "Install jaiabot-embedded package" "\nDo you want to install and configure the jaiabot-embedded Debian package?" && do_install=true

if [[ "$do_install" = "true" ]]; then
   if [[ "$USING_PRESEED" = "true" ]]; then
       echo "$jaia_embedded_debconf" | debconf-set-selections -
       debconf-get-selections | grep jaia
   fi
   if dpkg -s jaiabot-embedded; then
       # if it's already installed, reconfigure
       export DEBIAN_FRONTEND=noninteractive
       dpkg-reconfigure jaiabot-embedded;
   else
       # otherwise install it
       apt install -y /opt/jaiabot-embedded*.deb;
   fi
fi
   
echo "###############################################################"
echo "## Removing first-boot hooks so that this does not run again ##"
echo "###############################################################"

echo -e "\nUpdating /etc/overlayroot.conf to remove first-boot entries\n"

sed -i 's/##.*\(overlayroot=device\)/\1/' /etc/overlayroot.conf
sed -i '/FIRST BOOT/d' /etc/issue
echo "JAIABOT_FIRST_BOOT_DATE=\"`date -u`\"" >> /etc/jaiabot/version

# Finish


if [[ "$USING_PRESEED" = "true" ]]; then
    # avoid re-running with same preseed
    mount -o remount,rw /boot/firmware
    mv /boot/firmware/jaiabot/init/first-boot.preseed /boot/firmware/jaiabot/init/first-boot.preseed.complete
    mount -o remount,ro /boot/firmware
fi

run_wt_yesno jaia_reboot "First boot provisioning complete" \
             "\nDo you want to reboot into the complete system?" && reboot

exit 0
