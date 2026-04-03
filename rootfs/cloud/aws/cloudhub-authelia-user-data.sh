#!/bin/bash

# Source cloud.env to get fleet-specific values written by cloudhub-user-data.sh.in
source /etc/jaiabot/cloud.env
FLEET_ID=${jaia_fleet_index}
JCC_HUB_IP=${jaia_jcc_hub_ip}

## Swap file (needed for Authelia)
fallocate -l 1G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

## Install Authelia
curl -fsSL https://www.authelia.com/keys/authelia-security.gpg -o /usr/share/keyrings/authelia-security.gpg
echo 'deb [arch='$(dpkg --print-architecture)' signed-by=/usr/share/keyrings/authelia-security.gpg] https://apt.authelia.com stable main' | tee /etc/apt/sources.list.d/authelia.list > /dev/null
apt-get update && apt-get install -y authelia

mkdir /var/lib/authelia
chown authelia:authelia /var/lib/authelia

# Authelia configuration
mv /etc/authelia/configuration.yml /etc/authelia/configuration.yml.ex

jwt_secret=$(openssl rand -hex 64)
session_secret=$(openssl rand -hex 64)
storage_encryption_key=$(openssl rand -hex 64)
lldap_jwt_secret=$(openssl rand -hex 64)
lldap_key_seed=$(openssl rand -hex 64)
lldap_admin_password=$(openssl rand -hex 64)

cat <<EOF > /etc/authelia/configuration.yml
---
default_2fa_method: 'totp'
totp:
  disable: false
  issuer: 'cloud.jaia.tech'
webauthn:
  disable: false
  enable_passkey_login: true
  display_name: 'cloud.jaia.tech'
duo_api:
  disable: true
identity_validation:
  reset_password:
    jwt_secret: '$jwt_secret'
authentication_backend:
  ldap:
    implementation: 'lldap'
    address: 'ldap://localhost:3890'
    base_dn: 'DC=jaia,DC=tech'
    user: 'UID=admin,OU=people,DC=jaia,DC=tech'
    password: '$lldap_admin_password'
access_control:
  default_policy: 'deny'
  rules:
    - domain: 'f${FLEET_ID}.cloud.jaia.tech'
      policy: 'two_factor'
    - domain: 'lldap.f${FLEET_ID}.cloud.jaia.tech'
      policy: 'two_factor'
      subject: 'group:lldap_admin'
session:
  secret: '$session_secret'
  cookies:
     -
      domain: 'jaia.tech'
      authelia_url: 'https://auth.f${FLEET_ID}.cloud.jaia.tech'
storage:
  encryption_key: '$storage_encryption_key'
  local:
    path: '/var/lib/authelia/db.sqlite3'
notifier:
  smtp:
    address: 'smtp://smtp-relay.gmail.com:587'
    sender: 'Jaia <noreply@jaia.tech>'
    # Currently we are using GobySoft's SMTP relay (Google Workspace)
    identifier: 'gobysoft.org'
    subject: '[Jaia Cloud] {title}'
...
EOF

## Install reverse proxy caddy
apt-get install -y caddy

# caddy configuration
cat <<EOF > /etc/caddy/Caddyfile
# Authelia Portal.
auth.f${FLEET_ID}.cloud.jaia.tech {
        reverse_proxy localhost:9091
}

# Protected Endpoints.
(authelia_forward_auth) {
	forward_auth localhost:9091 {
		uri /api/authz/forward-auth
		copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
	}
}

lldap.f${FLEET_ID}.cloud.jaia.tech {
        import authelia_forward_auth
        reverse_proxy :17170
}

f${FLEET_ID}.cloud.jaia.tech {
        import authelia_forward_auth
        reverse_proxy [${JCC_HUB_IP}]:80
}
EOF

systemctl restart caddy

## LLDAP
mkdir /etc/lldap
cat <<EOF > /etc/lldap/docker-compose.yaml
version: "3"

volumes:
  lldap_data:
    driver: local

services:
  lldap:
    image: lldap/lldap:stable
    volumes:
      - "/var/lib/lldap:/data"
    ports:
      # web portal
      - "17170:17170"
      # ldap
      - "3890:3890"
    environment:
      - LLDAP_JWT_SECRET=$lldap_jwt_secret
      - LLDAP_KEY_SEED=$lldap_key_seed
      - LLDAP_LDAP_BASE_DN=dc=jaia,dc=tech
      - LLDAP_LDAP_USER_PASS=$lldap_admin_password
EOF

cat <<EOF > /etc/systemd/system/lldap.service
[Unit]
Description=LLDAP Docker
Requires=docker.service
After=docker.service

[Service]
Type=simple
WorkingDirectory=/etc/lldap
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
Restart=always
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
systemctl enable lldap
systemctl start lldap

## Enable Authelia service
systemctl enable authelia
systemctl start authelia
