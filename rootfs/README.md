# JaiaBot rootfs generation.

This folder contains [live-build](https://live-team.pages.debian.net/live-manual/html/live-manual/index.en.html) scripts for generating an Ubuntu root filesystem for booting on the embedded Linux computer (currently Raspberry Pi) or on a VirtualBox virtual machine.

Directory structure:
- rootfs/
  - auto: Live build scripts
  - customization: Live build configuration overrides
  - scripts: Scripts for creating/managing filesystem images
  - cloud: Scripts for configuration on various cloud providers (currently AWS)
  - virtualbox: Live build configuration overrides for VirtualBox VMs.

## CI Built images

As an alternative to cloning this repository and building images yourself, you can download them pre-built on [CircleCI](https://app.circleci.com/pipelines/github/jaiarobotics/jaiabot?branch=3.y). Browse to the latest build (`arm64-raspi-image-create-*` for the Raspberry Pi image, or `amd64-virtualbox-image-create-*` for the VirtualBox image), click "Artifacts", and download the appropriate file (.img.gz or .ova, respectively).

## Quick usage (build your own)

### Install Dependencies on Build machine

Install dependencies:

```
sudo apt install live-build qemu-user-static
```

### Run script to create USB key image

Creates (in current working directory) jaiabot_img-{version}.img (can be installed with `dd` or similar):

```
sudo rootfs/scripts/create_raspi_base_image.sh
```

### VirtualBox image

As an alternative to the Raspberry Pi image, an `amd64` virtual machine (.ova) can be created for use with VirtualBox by running

```
sudo rootfs/scripts/create_raspi_base_image.sh --virtualbox
```

To import multiple (e.g. 5 bots, 1 hub) VMs at once, use

```
# Usage ./import_vms.sh vm.ova n_bots n_hubs fleet_id
rootfs/scripts/import_vms.sh jaiabot_img-{version}.ova 5 1 25
```
