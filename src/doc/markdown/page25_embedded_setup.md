# Embedded Board Setup

## Raspberry Pi CM4

JaiaBot uses the Raspberry Pi CM4 Lite (without built-in eMMC) as the embedded Linux computer.

Installation steps:

- Download the SD card image (currently Ubuntu Server 20.04.2 LTS 64-bit): https://ubuntu.com/download/raspberry-pi

- Install (assuming SD card on /dev/sdd):

  ```bash
  unxz ubuntu-20.04.2-preinstalled-server-arm64+raspi.img.xz
  sudo dd if=ubuntu-20.04.2-preinstalled-server-arm64+raspi.img of=/dev/sdd bs=1M status=progress
  ```

- Connect to internet (DHCP)

- Log in as ubuntu and change password. This will log you out, so log back in.

- Clone the jaiabot repository to get a setup script, change directories and run it

  ```bash
  git clone https://github.com/jaiarobotics/jaiabot.git
  cd jaiabot/scripts/setup_embedded
  ./setup_embedded.sh
  ```

- After adding SSH key to ~/.ssh/authorized_keys, disallow SSH password login in `/etc/ssh/sshd_config` by changing the appropriate line to:

      PasswordAuthentication no
  
- Set up Wireguard client configuration using [VPN](page55_vpn.md) instructions.

- Install jaiabot code via instructions on the [CI/CD](page20_build.md) page from either the release or continuous repository.

## Raspberry Pi 3 B - semi-supported

