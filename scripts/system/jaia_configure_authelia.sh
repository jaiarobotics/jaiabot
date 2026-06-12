#!/bin/bash

set -u -e -o pipefail

## This script must be idempotent!!

##############
## Preamble ##
##############

## TODO - fetch me from Fleet Config
### !!!!!!!!!!!!!!!!!!!!!
base_uri=jaiaf6.gobysoft.org
admin_email=toby@gobysoft.org
### !!!!!!!!!!!!!!!!!!!!!

# Installs and (re)configures Authelia, Caddy, and LLDAP to provide a web-based authentication portal with user management for Cloudhub and friends.

## Versions
authelia_version=4.39.20-1 # apt
# use whatever caddy Ubuntu ships with
# caddy_version = ... # apt
lldap_version=v0.6.3 # docker

## Ports
lldap_ldap_port=3890
lldap_web_port=17170
jcc_port=8080
authelia_port=9991

## IP/URLs
set -a; source "/etc/jaiabot/runtime.env"; set +a;
#base_uri=f${jaia_fleet_index}.jaia.tech

# Currently we are using GobySoft's SMTP relay (Google Workspace)
smtp_address="smtp://smtp-relay.gmail.com:587"
ch_ip=$(jaia-ip.py --net=cloudhub_vpn --fleet_id=${jaia_fleet_index} --node=hub --node_id=30 --ipv6 addr)

# Persistent directories (between major upgrades)
auth_persistent_dir=/var/log/jaiabot/auth
authelia_persistent_dir=$auth_persistent_dir/authelia
lldap_persistent_dir=$auth_persistent_dir/lldap

if [ ! -d "$authelia_persistent_dir" ]; then
    mkdir -p $authelia_persistent_dir
    chown authelia:authelia $authelia_persistent_dir
fi

if [ ! -d "$lldap_persistent_dir" ]; then
    mkdir -p $lldap_persistent_dir
fi


# Swapfile (need more RAM to run both Authelia and Apache2/JCC)
swapfile=$auth_persistent_dir/swapfile
if [ ! -f $swapfile ]; then
    btrfs filesystem mkswapfile --size 2G $swapfile
    swapon $swapfile
fi

#################
## Apache Mods ##
#################

## Move JCC from port 80 to port 8080
sed -i -E \
    -e 's/^Listen[[:space:]]+80$/Listen 8080/' \
    /etc/apache2/ports.conf
sed -i -E \
    -e 's/<VirtualHost[[:space:]]+\*:80>/<VirtualHost *:8080>/I' \
    /etc/apache2/sites-available/jcc.conf

# Set up basic REST_API configuration with no key required
# (as Authelia will handle authentication for this too)
cat <<EOF > /etc/jaiabot/rest_api.pb.cfg
streaming_endpoint {
    hub_id: $jaia_hub_index
    hostname: "::1"
    port: 40000
}

key {
    private_key: ""
    permission: [ALL]
}
EOF

systemctl reload apache2

#########
## APT ##
#########

# Apt repo for Authelia
if [ ! -f /usr/share/keyrings/authelia-security.gpg ]; then
    curl -fsSL https://www.authelia.com/keys/authelia-security.gpg -o /usr/share/keyrings/authelia-security.gpg
    echo 'deb [arch='$(dpkg --print-architecture)' signed-by=/usr/share/keyrings/authelia-security.gpg] https://apt.authelia.com stable main' | tee /etc/apt/sources.list.d/authelia.list > /dev/null
fi

apt-get update && apt-get install -y authelia=$authelia_version caddy docker-compose-v2 fuse-overlayfs


##############
## Authelia ##
##############

# Update docker to use fuse-overlayfs (required to use overlayfs as backing filesystem for docker as overlayfs-on-overlayfs isn't supported)
cat <<EOF > /etc/docker/daemon.json
{
  "storage-driver": "fuse-overlayfs"
}
EOF

# Authelia configuration
mv /etc/authelia/configuration.yml /etc/authelia/configuration.yml.ex


authelia_secrets_file=$authelia_persistent_dir/secrets
if [ ! -f "$authelia_secrets_file" ]; then
    # generate secrets
    cat <<EOF > "$authelia_secrets_file"
    jwt_secret=$(openssl rand -hex 64)
    session_secret=$(openssl rand -hex 64)
    storage_encryption_key=$(openssl rand -hex 64)
    lldap_jwt_secret=$(openssl rand -hex 64)
    lldap_key_seed=$(openssl rand -hex 64)
    lldap_admin_password=$(openssl rand -hex 64)
EOF
fi
set -a; source "$authelia_secrets_file"; set +a;

cat <<EOF > /etc/authelia/configuration.yml
---
server:
  address: 'tcp://:$authelia_port'
default_2fa_method: 'totp'
totp:
  disable: false
  issuer: '$base_uri'
webauthn:
  disable: false
  enable_passkey_login: true
  display_name: '$base_uri'
duo_api:
  disable: true
identity_validation:
  reset_password:
    jwt_secret: '$jwt_secret'
authentication_backend:
  ldap:
    implementation: 'lldap'
    address: 'ldap://localhost:$lldap_ldap_port'
    base_dn: 'DC=jaia,DC=tech'
    user: 'UID=admin,OU=people,DC=jaia,DC=tech'
    password: '$lldap_admin_password'
access_control:
  default_policy: 'deny'
  rules: # order matters!
    # Allow group 'jdv' to access JDV
    - domain: run.$base_uri
      resources:
        - '^/jdv(?:/.*)?$'
      subject: 'group:jdv'
      policy: two_factor

    # Allow group 'jcu' to access JDV
    - domain: run.$base_uri
      resources:
        - '^/jcu(?:/.*)?$'
      subject:
        - 'group:jcu_user'
        - 'group:jcu_advanced'
        - 'group:jcu_developer'
      policy: two_factor

    # Block everyone else from JDV, JCU
    - domain: run.$base_uri
      resources:
        - '^/(jcu|jdv)(?:/.*)?$'
      policy: deny

    # Allow users in various 'rest_api' groups to access API with one-factor
    - domain: run.$base_uri
      resources:
        - '^/jaia/v[0-9]+/(status|metadata|task_packets|missions)(?:/.*)?$'
      subject: 
        - 'group:rest_api_read'
      policy: one_factor

    - domain: run.$base_uri
      resources:
        - '^/jaia(?:/.*)?$'
      subject: 
        - 'group:rest_api_all'
      policy: one_factor

    # Allow other JCC resources to 'run' group
    - domain: run.$base_uri
      subject: 'group:run'
      policy: two_factor

    # Allow all VirtualHub resources to 'sim' group
    - domain: sim.$base_uri
      subject: 'group:sim'
      policy: 'two_factor'

    - domain: users.$base_uri
      policy: 'two_factor'
      subject: 'group:lldap_admin'

session:
  secret: '$session_secret'
  cookies:
     - domain: '$base_uri'
       authelia_url: 'https://auth.$base_uri'
storage:
  encryption_key: '$storage_encryption_key'
  local:
    path: '$authelia_persistent_dir/db.sqlite3'
notifier:
  smtp:
    address: '$smtp_address'
    sender: 'Jaia <noreply@auth.$base_uri>'
    identifier: 'auth.$base_uri'
    subject: '[Jaia Cloud] {title}'
...
EOF

# Enable Authelia service
systemctl enable authelia

###########
## Caddy ##
###########
cat <<EOF > /etc/caddy/Caddyfile
# Redirect base URL to runtime JCC
$base_uri {
        redir https://run.$base_uri{uri} permanent
}

# Authelia Portal.
auth.$base_uri {
        reverse_proxy localhost:$authelia_port
}

# Protected Endpoints.
(authelia_forward_auth) {
	forward_auth localhost:$authelia_port {
		uri /api/authz/forward-auth
		copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
	}
}

users.$base_uri {
        import authelia_forward_auth
        reverse_proxy :$lldap_web_port
}

# Runtime JCC
run.$base_uri {
        import authelia_forward_auth
        reverse_proxy [$ch_ip]:$jcc_port
}

# VirtualFleet JCC
#sim.$base_uri {
#        import authelia_forward_auth
#        reverse_proxy [vfleethub_ip]:$jcc_port
#}

EOF

systemctl restart caddy

###########
## LLDAP ##
###########
mkdir -p /etc/lldap/bootstrap/group-configs
mkdir -p /etc/lldap/bootstrap/user-configs


# Create initial LLDAP group and user configurations
groups=(
    run
    sim
    jcu_user
    jcu_advanced
    jcu_developer
    jdv
    lldap_admin
    rest_api_read
    rest_api_all
)

admin_groups=()

# Create group config files
for group in "${groups[@]}"; do
    cat > "/etc/lldap/bootstrap/group-configs/${group}.json" <<EOF
{
  "name": "${group}"
}
EOF

    # Add all non-rest_api groups to admin
    if [[ ! "$group" =~ ^rest_api_ ]]; then
        admin_groups+=("\"$group\"")
    fi
done

# Create admin user config
cat > /etc/lldap/bootstrap/user-configs/admin.json <<EOF
{
  "id": "admin",
  "email": "$admin_email",
  "groups": [
    $(IFS=,
      echo "${admin_groups[*]}")
  ]
}
EOF

cat <<EOF > /etc/lldap/docker-compose.yaml
version: "3"

services:
  lldap:
    image: lldap/lldap:$lldap_version
    volumes:
      - "$lldap_persistent_dir:/data"
      - "/etc/lldap/bootstrap:/bootstrap"
    ports:
      # web portal
      - "$lldap_web_port:$lldap_web_port"
      # ldap
      - "$lldap_ldap_port:$lldap_ldap_port"
    environment:
      - LLDAP_JWT_SECRET=$lldap_jwt_secret
      - LLDAP_KEY_SEED=$lldap_key_seed
      - LLDAP_LDAP_BASE_DN=dc=jaia,dc=tech
      - LLDAP_LDAP_USER_PASS=$lldap_admin_password
      - LLDAP_LDAP_USER_EMAIL=$admin_email

      - LLDAP_URL=http://localhost:$lldap_web_port
      - LLDAP_ADMIN_USERNAME=admin
      - LLDAP_ADMIN_PASSWORD=$lldap_admin_password
      - GROUP_CONFIGS_DIR=/bootstrap/group-configs
      - USER_CONFIGS_DIR=/bootstrap/user-configs
      - DO_CLEANUP=false



EOF

cat <<EOF > /etc/systemd/system/lldap.service
[Unit]
Description=LLDAP Docker
Requires=docker.service
After=docker.service

[Service]
Type=simple
WorkingDirectory=/etc/lldap
ExecStart=/usr/bin/docker compose -f /etc/lldap/docker-compose.yaml up --remove-orphans
ExecStop=/usr/bin/docker compose -f /etc/lldap/docker-compose.yaml down

# We need the swap file for Authelia + JCC running on EC2 micro
# overlayroot won't allow swapfile in /etc/fstab, so we start/stop it here
ExecStartPre=-/usr/sbin/swapon $swapfile
ExecStopPost=-/usr/sbin/swapoff $swapfile

Restart=always
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
systemctl enable lldap
systemctl start lldap

# Run the bootstrap script
docker compose -f /etc/lldap/docker-compose.yaml exec lldap /app/bootstrap.sh

mkdir -p /etc/systemd/system/authelia.service.d
cat <<EOF > /etc/systemd/system/authelia.service.d/override.conf
[Unit]
Requires=lldap.service
After=lldap.service

[Service]
ExecStartPre=-/bin/sh -c 'until nc -z localhost $lldap_ldap_port; do sleep 1; done'
TimeoutStartSec=120
Restart=on-failure
RestartSec=10s
EOF

systemctl start authelia


##############
## Firewall ##
##############

# Add firewall to UFW (AWS done at CloudHub creation time)
ufw allow in on eth0 to any port 80 proto tcp
ufw allow in on eth0 to any port 443 proto tcp
