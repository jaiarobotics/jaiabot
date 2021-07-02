# Embedded Board Setup

## Raspberry Pi CM4

Jaiabot uses the Raspberry Pi CM4 Lite (without built-in eMMC) as the embedded Linux computer.

Installation steps:

- Download the SD card image (currently Ubuntu Server 20.04.2 LTS 64-bit): https://ubuntu.com/download/raspberry-pi
- Install (assuming SD card on /dev/sdd):

        unxz ubuntu-20.04.2-preinstalled-server-arm64+raspi.img.xz
        sudo dd if=ubuntu-20.04.2-preinstalled-server-arm64+raspi.img of=/dev/sdd bs=1M status=progress

- Enable USB in config.txt:

        [pi4]
        ...
        dtoverlay=dwc2,dr_mode=host

- Connect to internet (DHCP)
- Login as ubuntu and change password.
- Install apt packages:

        sudo apt update
        sudo apt install wireguard jaiabot-apps
        # (optional)
        sudo apt install emacs

- After adding SSH key to ~/.ssh/authorized_keys, disallow SSH password login in `/etc/ssh/sshd_config` to change the appropriate line to:

        PasswordAuthentication no
