#!/bin/bash

set -u -e -o pipefail

## This script must be idempotent!!
# Installs and (re)configures Authelia, Caddy, and LLDAP to provide a web-based authentication portal with user management for Cloudhub and friends.

##############
## Preamble ##
##############

jaia_auth_lldap_bootstrap_completed=false
jaia_auth_lldap_bootstrap_generation=0

set -a
source "/etc/jaiabot/jaia.env"
source "/etc/jaiabot/cloud.env"
source "/usr/share/jaiabot/common-versions.env"
set +a

## Versions
# use whatever caddy Ubuntu ships with
# caddy_version = ... # apt

## Ports
lldap_ldap_port=3890
lldap_web_port=17170
jcc_port=8080
authelia_port=9991
support_portal_port=9992

## IP/URLs
base_uri=$jaia_auth_base_uri
admin_email=$jaia_auth_admin_email
smtp_address=$jaia_auth_smtp_address

ch_ip=$(jaia_ip --query_type addr --ip_net cloudhub_vpn --fleet_id ${jaia_fleet_id} --node_type hub --node_id $(jaia_bounds --cloudhub_id) --ip_version ipv6)
vh1_ip=$(jaia_ip --query_type addr --ip_net vfleet_vpn --fleet_id ${jaia_fleet_id} --node_type hub --node_id 1 --ip_version ipv6)

# Persistent directories (between major upgrades)
auth_persistent_dir=/var/log/jaiabot/auth
authelia_persistent_dir=$auth_persistent_dir/authelia
lldap_persistent_dir=$auth_persistent_dir/lldap
support_persistent_dir=$auth_persistent_dir/support


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
    hub_id: $jaia_hub_id
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

# A series, not an exact version: Authelia migrates its database forward and cannot read it
# once a newer release has, so a node must never go back to an older one. Below 1000 so apt
# never downgrades.
cat <<EOF > /etc/apt/preferences.d/authelia
Package: authelia
Pin: version ${jaia_version_authelia_series}.*
Pin-Priority: 990
EOF

apt-get update && apt-get install -y authelia caddy docker-compose-v2 fuse-overlayfs ldap-utils


##############
## Authelia ##
##############

# RFC 2606 and RFC 6761 reserve these names, so this is a CI or bench CloudHub rather than
# one anybody reaches: no public CA can issue for it and there is no mail relay behind it
case "$base_uri" in
    *.invalid|*.test|*.example|*.localhost|localhost)
        throwaway_deployment=true
        echo "$base_uri is a reserved domain: serving TLS from Caddy's own CA and not dialling SMTP at startup"
        ;;
    *)
        throwaway_deployment=false
        ;;
esac

if $throwaway_deployment; then
    caddy_tls="tls internal"
    # Authelia dials the relay at startup and exits fatally when it cannot connect, which
    # with Restart=on-failure is an endless restart loop and a 502 from Caddy for good
    notifier_startup_check="disable_startup_check: true"
else
    caddy_tls=""
    notifier_startup_check="disable_startup_check: false"
fi



if [ ! -d "$authelia_persistent_dir" ]; then
    mkdir -p $authelia_persistent_dir
fi
# recursive: this directory outlives the rootfs, and the authelia uid a new image
# allocates need not be the one that wrote the database before a major upgrade
chown -R authelia:authelia $authelia_persistent_dir

# Update docker to use fuse-overlayfs (required to use overlayfs as backing filesystem for docker as overlayfs-on-overlayfs isn't supported)
if [ ! -f /etc/docker/daemon.json ]; then
    cat <<EOF > /etc/docker/daemon.json
{
  "storage-driver": "fuse-overlayfs"
}
EOF
    systemctl restart docker
fi

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
    chmod 0600 $authelia_secrets_file
fi
set -a; source "$authelia_secrets_file"; set +a;

cat <<EOF > /etc/authelia/configuration.yml
---
server:
  address: 'tcp://:$authelia_port'
default_2fa_method: 'webauthn'
webauthn:
  disable: false
  enable_passkey_login: false
  display_name: '$base_uri'
totp:
  disable: true
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
    user: 'UID=jaia_admin,OU=people,DC=jaia,DC=tech'
    password: '$lldap_admin_password'
access_control:
  default_policy: 'deny'
  rules: # order matters!
    # Allow group 'jdv' to access JDV
    - domain: run.$base_uri
      resources:
        - '^/jdv(?:/.*)?$'
      subject:
        - 'group:jdv'
        - 'group:super_admin'
      policy: two_factor

    # Allow group 'jcu_*' to access JCU
    - domain: run.$base_uri
      resources:
        - '^/jcu(?:/.*)?$'
      subject:
        - 'group:jcu_user'
        - 'group:jcu_advanced'
        - 'group:jcu_developer'
        - 'group:super_admin'
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
        - 'group:super_admin'
      policy: one_factor

    - domain: run.$base_uri
      resources:
        - '^/jaia(?:/.*)?$'
      subject: 
        - 'group:rest_api_all'
        - 'group:super_admin'
      policy: one_factor

    # Allow other JCC resources to 'run' group
    - domain: run.$base_uri
      subject:
        - 'group:run'
        - 'group:super_admin'
      policy: two_factor

    # Allow all VirtualHub resources to 'sim' group
    - domain: sim.$base_uri
      subject:
        - 'group:sim'
        - 'group:super_admin'
      policy: 'two_factor'

    - domain: users.$base_uri
      policy: 'two_factor'
      subject:
        - 'group:lldap_admin'
        - 'group:super_admin'

    # Whoever administers the directory is who decides on Jaia's access to the fleet
    - domain: support.$base_uri
      policy: 'two_factor'
      subject:
        - 'group:lldap_admin'
        - 'group:super_admin'

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
  $notifier_startup_check
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
        $caddy_tls
        redir https://run.$base_uri{uri} permanent
}

# Authelia Portal.
auth.$base_uri {
        $caddy_tls
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
        $caddy_tls
        import authelia_forward_auth
        reverse_proxy :$lldap_web_port
}

# Jaia support access
support.$base_uri {
        $caddy_tls
        import authelia_forward_auth
        reverse_proxy :$support_portal_port
}

# Runtime JCC
run.$base_uri {
        $caddy_tls
        import authelia_forward_auth
        reverse_proxy [$ch_ip]:$jcc_port
}

# VirtualFleet JCC
sim.$base_uri {
        $caddy_tls
        import authelia_forward_auth
        reverse_proxy [$vh1_ip]:80
}

EOF

# Caddy starts with its stock Caddyfile when installed, so reload to apply ours (graceful if running)
systemctl reload-or-restart caddy

##################
## Support keys ##
##################

# Written here rather than into the image's jaia_sshd.conf: the directory it
# queries is on this machine's loopback, so this is the one node where an
# LDAP-backed sshd is not something to be reached across the link being
# debugged.
cat <<EOF > /etc/ssh/sshd_config.d/jaia_support.conf
AuthorizedKeysCommand /usr/bin/jaia-support-authorized-keys.sh %u
AuthorizedKeysCommandUser root
EOF
sshd -t && systemctl reload-or-restart ssh

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
    super_admin
    rest_api_read
    rest_api_all
    jaia_support
)

# Create group config files
for group in "${groups[@]}"; do
    cat > "/etc/lldap/bootstrap/group-configs/${group}.json" <<EOF
{
  "name": "${group}"
}
EOF
done

# LLDAP's own name for this attribute (example_configs/pam). bootstrap.sh defaults
# USER_SCHEMAS_DIR to /bootstrap/user-schemas, which the existing mount covers.
mkdir -p /etc/lldap/bootstrap/user-schemas
cat > /etc/lldap/bootstrap/user-schemas/sshPublicKey.json <<EOF
{
  "name": "sshPublicKey",
  "attributeType": "STRING",
  "isEditable": true,
  "isList": true,
  "isVisible": true
}
EOF

# Groupless: the account exists so a key can hang off it and the customer has
# someone to add, but it reaches nothing until they put it in jaia_support.
# No "groups" key rather than an empty one, so no reading of this file can
# revoke a grant the customer has made.
cat > /etc/lldap/bootstrap/user-configs/jaia_support.json <<EOF
{
  "id": "jaia_support",
  "email": "support@jaia.tech"
}
EOF

# Create jaia_admin user config
cat > /etc/lldap/bootstrap/user-configs/jaia_admin.json <<EOF
{
  "id": "jaia_admin",
  "email": "$admin_email",
  "groups": ["super_admin", "lldap_admin"
  ]
}
EOF

cat <<EOF > /etc/lldap/docker-compose.yaml
services:
  lldap:
    image: lldap/lldap:$jaia_version_lldap
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
      - LLDAP_LDAP_USER_DN=jaia_admin
      - LLDAP_LDAP_USER_PASS=$lldap_admin_password
      - LLDAP_LDAP_USER_EMAIL=$admin_email

      - LLDAP_URL=http://localhost:$lldap_web_port
      - LLDAP_ADMIN_USERNAME=jaia_admin
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
# overlayroot won't allow swapfile in /etc/fstab, so we start it here
ExecStartPre=-/usr/sbin/swapon $swapfile

Restart=always
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
systemctl enable lldap
systemctl start lldap

# Bump when the groups, users or schemas above change: the guard below records
# which set was applied, so a CloudHub bootstrapped before a new one existed
# runs bootstrap.sh once more rather than never seeing it.
lldap_bootstrap_generation=1

# Superseded by the generation; true means generation 0 was applied
if $jaia_auth_lldap_bootstrap_completed; then
    sed -i '/^jaia_auth_lldap_bootstrap_completed=/d' /etc/jaiabot/cloud.env
fi

if (( ${jaia_auth_lldap_bootstrap_generation:-0} < lldap_bootstrap_generation )); then
    # -T because cloud-init gives this no TTY, and bounded because a first boot that
    # never returns leaves the machine without the reboot that mounts overlayroot
    for attempt in $(seq 1 120); do
        if docker compose -f /etc/lldap/docker-compose.yaml exec -T lldap /app/bootstrap.sh; then
            sed -i '/^jaia_auth_lldap_bootstrap_generation=/d' /etc/jaiabot/cloud.env
            echo "jaia_auth_lldap_bootstrap_generation=${lldap_bootstrap_generation}" >> /etc/jaiabot/cloud.env
            break
        fi
        if (( attempt == 120 )); then
            echo "ERROR: LLDAP bootstrap did not succeed after ${attempt} attempts" >&2
            exit 1
        fi
        sleep 1
    done
fi

mkdir -p /etc/systemd/system/authelia.service.d
cat <<EOF > /etc/systemd/system/authelia.service.d/override.conf
[Unit]
Requires=lldap.service
After=lldap.service

[Service]
ExecStartPre=-/bin/bash -c 'for i in {1..110}; do (exec 3<>/dev/tcp/127.0.0.1/$lldap_ldap_port) 2>/dev/null && exit 0; sleep 1; done; exit 1'
TimeoutStartSec=120
Restart=on-failure
RestartSec=10s
EOF

systemctl daemon-reload
systemctl start authelia


####################
## Support portal ##
####################

if [ ! -d "$support_persistent_dir" ]; then
    mkdir -p $support_persistent_dir
    chmod 0700 $support_persistent_dir
fi

# The portal's trust root, in the form ssh-keygen -Y verify reads. Derived from
# the root keys the image already carries rather than from a list kept here, so
# adding or retiring a Yubikey is the one edit it has always been. Written whole
# so a request is never checked against a half-written file.
mkdir -p /etc/jaiabot/support
awk '$1 ~ /^(ssh|sk-ssh|ecdsa|sk-ecdsa)-/ { print "jaia-support", $1, $2 }' \
    /etc/jaiabot/ssh/root_authorized_keys > /etc/jaiabot/support/allowed_signers.new
[ -s /etc/jaiabot/support/allowed_signers.new ]
mv /etc/jaiabot/support/allowed_signers.new /etc/jaiabot/support/allowed_signers

cat > /etc/systemd/system/jaia_support_portal.service <<EOF
[Unit]
Description=Jaia support access portal
After=lldap.service
Wants=lldap.service

[Service]
ExecStart=/usr/bin/jaia-support-portal.py
Environment=JAIA_FLEET_ID=$jaia_fleet_id
Environment=JAIA_SUPPORT_PORTAL_PORT=$support_portal_port

# Root for the directory password, and nothing else it does not need. /home
# stays visible: ending a grant reaches the fleet over the CloudHub's own SSH
# key, which lives in the jaia user's home.
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true
ReadWritePaths=$support_persistent_dir

Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# Group membership has no expiry of its own, and neither does a WireGuard peer,
# so this is the one mechanism that ends a grant nobody remembers to end.
cat > /etc/systemd/system/jaia_support_reconcile.service <<EOF
[Unit]
Description=Bring Jaia's support access back in line with what the customer granted
After=lldap.service
Wants=lldap.service

[Service]
Type=oneshot
ExecStart=/usr/bin/jaia-support-access.py reconcile
Environment=JAIA_FLEET_ID=$jaia_fleet_id
EOF

cat > /etc/systemd/system/jaia_support_reconcile.timer <<EOF
[Unit]
Description=Bring Jaia's support access back in line with what the customer granted

[Timer]
# On boot as well as on the interval: a grant must not outlive a CloudHub that
# happened to be switched off when it expired
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable jaia_support_portal
systemctl restart jaia_support_portal
systemctl enable --now jaia_support_reconcile.timer

##############
## Firewall ##
##############

# Add firewall to UFW (AWS done at CloudHub creation time)
ufw allow in on eth0 to any port 80 proto tcp
ufw allow in on eth0 to any port 443 proto tcp
