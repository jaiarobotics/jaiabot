# Embedded Board Setup

JaiaBot uses the Raspberry Pi CM4 Lite as the embedded Linux computer. For R&D Purposes, it has also been necessary to run the jaiabot software on a Raspberry Pi 3 although this is not ideal due to the port mappings being unequivalent to the 4.

Installation steps:

- Download the SD card image (currently Ubuntu Server 20.04.4 LTS 64-bit): https://ubuntu.com/download/raspberry-pi

- Install via command line (or use something like balenaEtcher https://www.balena.io/etcher/):

	```bash
	unxz ubuntu-20.04.4-preinstalled-server-arm64+raspi.img.xz
	# assuming µSD card on /dev/sdd
	sudo dd if=ubuntu-20.04.4-preinstalled-server-arm64+raspi.img of=/dev/sdd bs=1M status=progress
	```
        
- If you have access to a LAN connection to the internet (DHCP) do so and power up the Pi. You will need to find the ip address from your router.
  - ssh in as `ubuntu` `ubuntu` and change password. This will log you out, so log back in.

- Else:
  - Create a file named `99-disable-network-config.cfg` in /etc/cloud/cloud.cfg.d/
    - Edit the contents to be:
  
		```bash
		network: {config: disabled}
		```
    - Make sure the user and group are root
  - Create a file named `50-cloud-init.yaml` in /etc/netplan/
    - Edit the contents to be (with XXX as the Wi-Fi network name and YYY as the password):
    
		```bash
		# This file is generated from information provided by the datasource.  Changes
      # to it will not persist across an instance reboot.  To disable cloud-init's
      # network configuration capabilities, write a file
      # /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg with the following:
      # network: {config: disabled}
      network:
          ethernets:
              eth0:
                  dhcp4: true
                  optional: true
          version: 2
          wifis:
              wlan0:
                  optional: true
                  access-points:
                    "XXX":
                          password: "YYY"
          dhcp4: true
      ```

    - Make sure the user and group are root
  - Connect the Pi to a keyboard and mouse and login as `ubuntu` `ubuntu`. You will need to change the password upon login.
  - Run:
    
    ```bash
    sudo netplan generate
    sudo netplan apply
    ```
    
  - You can now ssh in or stay at the keyboard to continue

- Clone the jaiabot repository to get a setup script, change directories and run it (with xxx as either _bot_ or _hub_ and yyy as the serial number)

  ```bash
  git clone https://github.com/jaiarobotics/jaiabot.git
  cd jaiabot/scripts/setup_embedded
  sudo ./setup_embedded.sh xxx yyy
  ```

- After adding SSH key to ~/.ssh/authorized_keys, disallow SSH password login in `/etc/ssh/sshd_config` by changing the appropriate line to:

      PasswordAuthentication no
  
- Set up Wireguard client configuration using [VPN](page55_vpn.md) instructions.

- Install jaiabot code via instructions on the [CI/CD](page20_build.md) page from either the release or continuous repository.

