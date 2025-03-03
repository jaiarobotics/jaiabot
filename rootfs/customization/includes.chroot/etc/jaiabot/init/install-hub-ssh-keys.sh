#!/bin/bash

script_dir=$(dirname $0)
PRESEED_DIR="/boot/firmware/jaiabot/init"
SSH_DIR="/home/jaia/.ssh"
CONFIG_FILE="$SSH_DIR/config"

INCLUDES_HUB_KEYS=false
HUB_PRIVATE_KEY=""
HUB_PUBLIC_KEY=""

# Search for hub ssh key pair
for PRIVATE in "$PRESEED_DIR/"hub*_fleet*; do
    PUBLIC="${PRIVATE}.pub"
    if [ -e "$PRIVATE" ] && [ -e "$PUBLIC" ]; then
        HUB_PRIVATE_KEY="$PRIVATE"
        HUB_PUBLIC_KEY="$PUBLIC"
        INCLUDES_HUB_KEYS=true
        break
    fi
done

if [ "$INCLUDES_HUB_KEYS" = true ]; then
    echo "Found private key: $HUB_PRIVATE_KEY and public key: $HUB_PUBLIC_KEY. Proceeding with setup..."

    # Move the files to the .ssh directory
    mount -o remount,rw /boot/firmware
    mv "$HUB_PRIVATE_KEY" "$SSH_DIR/"
    mv "$HUB_PUBLIC_KEY" "$SSH_DIR/"

    # Extract just the base filename for use in config
    PRIVATE_BASENAME=$(basename "$HUB_PRIVATE_KEY")

    # Set permissions for the keys
    chmod 600 "$SSH_DIR/$PRIVATE_BASENAME"
    chmod 644 "$SSH_DIR/$PRIVATE_BASENAME.pub"

    # Create the SSH config file and Clear the file if it exists
    > "$CONFIG_FILE" 
    cat >> "$CONFIG_FILE" <<EOL
Host 10.23.*.*
    StrictHostKeyChecking accept-new
    IdentityFile $SSH_DIR/$PRIVATE_BASENAME 
EOL

    # Set permissions for the config file
    chmod 600 "$CONFIG_FILE"

    chown -R jaia:jaia /home/jaia/.ssh

    echo "Setup completed. SSH keys and config file are in $SSH_DIR."
fi
