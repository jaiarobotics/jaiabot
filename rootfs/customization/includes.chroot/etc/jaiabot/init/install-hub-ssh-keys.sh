#!/bin/bash

script_dir=$(dirname $0)
PRESEED_DIR="/boot/firmware/jaiabot/init"
SSH_DIR="/home/jaia/.ssh"
CONFIG_FILE="$SSH_DIR/config"

source /usr/bin/jaia-debconf.sh

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
elif [ "$(jaia_debconf_get type)" = "hub" ] && [ "$(jaia_debconf_node_id)" = "$(jaia_bounds --cloudhub_id)" ]; then
    # A CloudHub has no Yubikey, so its key is made here and never leaves it: create_cloudhub
    # copies the public half into the fleet config for the other nodes
    fleet=$(jaia_debconf_get fleet_id)
    id=$(jaia_debconf_node_id)
    PRIVATE_BASENAME="hub${id}_fleet${fleet}"
    echo "No hub key provided: generating $SSH_DIR/$PRIVATE_BASENAME for this CloudHub"
    ssh-keygen -q -t ed25519 -N "" -C "$PRIVATE_BASENAME" -f "$SSH_DIR/$PRIVATE_BASENAME"

    # The fleet config this node was configured from cannot have carried it yet
    cloudhub_ip=$(jaia_ip --query_type addr --node_type hub --ip_net cloudhub_vpn --fleet_id ${fleet} --node_id ${id})
    echo "from=\"${cloudhub_ip}\" $(cat "$SSH_DIR/$PRIVATE_BASENAME.pub")" >> /etc/jaiabot/ssh/hub_authorized_keys
    INCLUDES_HUB_KEYS=true
fi

if [ "$INCLUDES_HUB_KEYS" = true ]; then
    # Set permissions for the keys
    chmod 600 "$SSH_DIR/$PRIVATE_BASENAME"
    chmod 644 "$SSH_DIR/$PRIVATE_BASENAME.pub"

    # Create the SSH config file and Clear the file if it exists
    > "$CONFIG_FILE"
    cat >> "$CONFIG_FILE" <<EOL
Host 10.23.*.*
    StrictHostKeyChecking accept-new
    IdentityFile $SSH_DIR/$PRIVATE_BASENAME

Host fddd:7f2e:3258:*
    StrictHostKeyChecking accept-new
    IdentityFile $SSH_DIR/$PRIVATE_BASENAME

Host fd0f:77ac:4fdf:*
    StrictHostKeyChecking accept-new
    IdentityFile $SSH_DIR/$PRIVATE_BASENAME
EOL

    # Set permissions for the config file
    chmod 600 "$CONFIG_FILE"

    chown -R jaia:jaia /home/jaia/.ssh

    echo "Setup completed. SSH keys and config file are in $SSH_DIR."
fi
