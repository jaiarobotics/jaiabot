#!/bin/bash

# Install Authelia
curl -fsSL https://www.authelia.com/keys/authelia-security.gpg -o /usr/share/keyrings/authelia-security.gpg
echo  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/authelia-security.gpg] https://apt.authelia.com stable main" | tee /etc/apt/sources.list.d/authelia.list > /dev/null
apt update && apt install -y authelia

# Install reverse proxy
apt install -y caddy


# Write config file (/etc/authelia/configuration.yaml)
# TODO

# Enable Authelia service
systemctl enable authelia
systemctl start authelia
