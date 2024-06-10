# JaiaBot rootfs generation.

This repository contains [live-build](https://live-team.pages.debian.net/live-manual/html/live-manual/index.en.html) scripts for generating an Ubuntu root filesystem for booting on the embedded Linux computer (currently Raspberry Pi) or on a VirtualBox virtual machine.

## CI Built images

As an alternative to cloning this repository and building images yourself, you can download them pre-built on [CircleCI](https://app.circleci.com/pipelines/github/jaiarobotics/jaiabot-rootfs-gen). Browse to the latest build (raspi-image-create for the Raspberry Pi image, or virtualbox-image-create for the VirtualBox image), click "Artifacts", and download the appropriate file (.img.gz or .ova, respectively).


## Quick usage (build your own)

### Install Dependencies on Build machine

Install dependencies (tested on Ubuntu 20.04):

```
sudo apt install live-build qemu-user-static
```

### Run script to create USB key image

Creates (in current working directory) jaiabot_img-{version}.img (can be installed with `dd` or similar):

```
sudo jaiabot-rootfs-gen/scripts/create_raspi_base_image.sh
```

### VirtualBox image

As an alternative to the Raspberry Pi image, an `amd64` virtual machine (.ova) can be created for use with VirtualBox by running

```
sudo jaiabot-rootfs-gen/scripts/create_raspi_base_image.sh --virtualbox
```

To import multiple (e.g. 5 bots, 1 hub) VMs at once, use

```
# Usage ./import_vms.sh vm.ova n_bots n_hubs fleet_id
jaiabot-rootfs-gen/scripts/import_vms.sh jaiabot_img-{version}.ova 5 1 25
```
