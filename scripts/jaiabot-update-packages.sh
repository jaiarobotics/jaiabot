#!/bin/bash

echo "Updating this systems packages..."

sudo apt update

sudo mount -o remount,rw /boot/firmware

sudo apt upgrade -y

sudo mount -o remount,r /boot/firmware

echo "Systems packages are up-to-date."

