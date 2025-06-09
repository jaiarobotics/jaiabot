# RPICam for Raspi Zero

This directory modifies a Raspbian arm64 image Lite (Bookworm) to install the code and configuration needed for Jaia's Camera Raspi Zero.

It uses Packer to modify the stock image.

## Build

Requires Ubuntu or similar image with [Packer installed](https://developer.hashicorp.com/packer/tutorials/docker-get-started/get-started-install-cli).

```
cd jaiabot/rootfs/rpicam-zero
./build.sh
```




## Acknowledgements

Configuration inspired by https://github.com/jsiebens/rpi-cloud-init. 
