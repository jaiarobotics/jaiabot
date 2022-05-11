# Embedded Board Setup

JaiaBot uses the Raspberry Pi (RP) Compute Module (CM) 4 Lite as the embedded Linux computer. For R&D Purposes, it has also been necessary to run the jaiabot software on a Raspberry Pi 3 although this is not ideal due to the port mappings being different from the RP4.

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
    sudo ./setup_embedded_release.sh xxx yyy
    ```

- After adding SSH key to ~/.ssh/authorized_keys, disallow SSH password login in `/etc/ssh/sshd_config` by changing the appropriate line to:

    ```PasswordAuthentication no```
  
- Set up Wireguard client configuration using [VPN](page55_vpn.md) instructions.
- Install the software using the `jaiabot-embedded` apt metapackage:
	```
	# add packages.gobysoft.org to your apt sources
	echo "deb http://packages.gobysoft.org/ubuntu/release/ `lsb_release -c -s`/" | sudo tee /etc/apt/sources.list.d/gobysoft_release.list
	# install the public key for packages.gobysoft.org
	sudo apt-key adv --recv-key --keyserver keyserver.ubuntu.com 19478082E2F8D3FE
	# update the apt package manager
	sudo apt update
	# install all the necessary packages (jaiabot-embedded will install jaiabot-apps, jaiabot-python, and all other dependencies)
	sudo apt -y install jaiabot-embedded
	# answer the questions from debconf and systemd, etc. will be automatically configured, and the jaiabot applications started.
	# see if everything is running OK.
	systemctl list-units "jaiabot*"
	```
  If you wish to use the continuous repository (latest commit to the main `1.y` branch,) substitute "continuous" for "release" in the first command above).

## Systemd

We use `systemd` to launch the jaiabot services on the embedded system, just as any other Ubuntu daemon.

Each application has a service definition, and they are all set to `BindTo` the `jaia.service` which exists to provide a common service that can be `stop`ped or `start`ed, thereby stopping or starting all the bound services.

### Quick start

When using a built-from-source version of jaiabot, ensure that the local bin directory is on your `$PATH` (e.g., check that `which jaiabot_mission_manager` returns the correct binary), then run:

Bot 0 (install and enable):
```
cd jaiabot/config/gen
./systemd-local.sh bot --bot_index 0 --n_bots 4 --enable
```

Hub (install and enable):

```
cd jaiabot/config/gen
./systemd-local.sh hub --n_bots 4 --enable
```

See `./systemd-local.sh --help` for more options.

### Design

The systemd services are all controlled by a single `jaiabot.service` which doesn't do anything itself, but serves as a single point from which all the other services can be stopped, started, etc.

Then, `jaiabot_gobyd` and `jaiabot_moosdb` are bound to `jaiabot` and start their respective middleware's broker (`gobyd` and `MOOSDB`). From there, all the client services are bound to the respective broker's service. This ensures that no Goby apps are started before `gobyd` and no MOOS apps are started before `MOOSDB`. The Python apps are also bound to `jaiabot_gobyd` at the moment since they are used exclusively by the Goby driver applications. If this changes, these services can be updated.

![](../figures/systemd.png)


### Generation

The systemd service files are generated via templates much like the application configuration.

The generation script lives in: `jaiabot/config/gen/systemd.py` and can be run to install systemd service jobs for either a locally built copy of jaiabot or used during the Debian package build.

To see all the options for configuring this script, run `systemd.py --help`

For a locally built copy, you can use the `systemd-local.sh` shell script (a thin wrapper around `systemd.py` that executes `systemd.py` using the current interactive shell settings, such as `$PATH`).

This script will generally have the correct defaults for the various directories, assuming that the version of the `jaiabot` apps and the Goby applications (`gobyd`, etc.) that you wish to run are currently set correctly in the shell `$PATH` environmental variable at the time of running the `gen/systemd-local.sh` generation script.

Running `./systemd-local.sh --help` will always show the defaults inferred from the `$PATH` for all the directories (`--jaiabot_bin_dir`, `--jaiabot_share_dir`, etc.)

### Usage

- To start, stop, or restart all the JaiaBot applications:
	```
	sudo systemctl start jaiabot
	```
	```
	sudo systemctl stop jaiabot
	```
	```
	sudo systemctl restart jaiabot
	```
	
- To start (or stop, restart) a single application:
	```
	sudo systemctl start jaiabot_control_surfaces_driver
	```	
- To get a quick summary of all the applications' status:
	```
	systemctl list-units "jaiabot*"
	```
- To get the full log from a particular service (stdout/stderr),
	```
	sudo journalctl -u jaiabot_control_surfaces_driver
	```
- To get a summary and the last few lines of the log,
	```
	sudo systemctl status jaiabot_control_surfaces_driver
	```
	

## Testing with Vagrant

[Vagrant](https://www.vagrantup.com) is a useful tool for creating and managing full virtual machines (VMs), which allows us to quickly spin up and delete standard amd64 VMs for deployment testing (such as `systemd` or package testing before deployment to the actual Raspberry Pi hardware).

### Install

```
sudo apt install vagrant
```

### Initialize machine

```
vagrant init ubuntu/focal64
```

This generates a `Vagrantfile` in the current working directory, which can be modified to fit our needs. For example, to create a VM for [Virtualbox](https://www.virtualbox.org/) with 8 CPUs and 1GB memory, we can uncomment and edit this block from the `Vagrantfile`:

```
  config.vm.provider "virtualbox" do |vb|
     # Display the VirtualBox GUI when booting the machine
     vb.gui = false
     vb.cpus = 8
     # Customize the amount of memory on the VM:
     vb.memory = "1024"
  end
```

###  Start machine

To start the machine from the directory with the `Vagrantfile`, simply run
```
vagrant up
```

To ssh in, run

```
vagrant ssh
```

### Other commands

To destroy the VM, use `vagrant destroy`.
