#!/bin/bash

set -u -e -o pipefail

## This script must be idempotent!!
# Installs and (re)configures Authelia, Caddy, and LLDAP to provide a web-based authentication portal with user management for Cloudhub and friends.

##############
## Preamble ##
##############

jaia_auth_lldap_bootstrap_completed=false

set -a
source "/etc/jaiabot/runtime.env"
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

## IP/URLs
base_uri=$jaia_auth_base_uri
admin_email=$jaia_auth_admin_email
smtp_address=$jaia_auth_smtp_address
smtp_sender=${jaia_auth_smtp_sender:-noreply@auth.jaia.tech}
# Keep this default in sync with create_vpc.sh
smtp_credentials_parameter=${jaia_auth_smtp_credentials_ssm_parameter:-/jaia/cloudhub/smtp_credentials}

ch_ip=$(jaia-ip.py --net=cloudhub_vpn --fleet_id=${jaia_fleet_index} --node=hub --node_id=30 --ipv6 addr)
vh1_ip=$(jaia-ip.py --net=vfleet_vpn --fleet_id=${jaia_fleet_index} --node=hub --node_id=1 --ipv6 addr)

# Landing page and shared navigation (static, from jaiabot-web)
jaia_cloud_web_dir=/usr/share/jaiabot/web/cloud

# Persistent directories (between major upgrades)
auth_persistent_dir=/var/log/jaiabot/auth
authelia_persistent_dir=$auth_persistent_dir/authelia
lldap_persistent_dir=$auth_persistent_dir/lldap


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

# A series, not an exact version: Authelia migrates its database forward and cannot read it
# once a newer release has, so a node must never go back to an older one. Below 1000 so apt
# never downgrades.
cat <<EOF > /etc/apt/preferences.d/authelia
Package: authelia
Pin: version ${jaia_version_authelia_series}.*
Pin-Priority: 990
EOF

apt-get update && apt-get install -y authelia caddy docker-compose-v2 fuse-overlayfs

##################
## Custom Caddy ##
##################

# Ubuntu's caddy lacks the replace-response plugin that injects the shared
# navigation into every proxied page, so fetch a build with it from the Caddy
# download service and install it beside the apt binary the way the Caddy docs
# recommend for deb installs: apt keeps upgrading the diverted caddy.default
# while update-alternatives points /usr/bin/caddy at caddy.custom.
caddy_custom=/usr/bin/caddy.custom
caddy_plugin=github.com/caddyserver/replace-response
caddy_plugin_version=$jaia_version_caddy_replace_response
caddy_binary_changed=false

caddy_has_plugin() {
    # list-modules prints "http.handlers.replace_response <version>" and build-info
    # prints "dep <module> <version>"; either confirms the pinned plugin
    [ -x "$1" ] && { "$1" list-modules --versions; "$1" build-info; } 2>/dev/null \
        | grep -E "replace[-_]response[[:space:]]+${caddy_plugin_version}([[:space:]]|$)" >/dev/null
}

if ! caddy_has_plugin "$caddy_custom"; then
    # Download next to the destination: /tmp may be mounted noexec
    caddy_download=$caddy_custom.tmp
    if curl -fsSL --retry 3 --retry-delay 10 -o "$caddy_download" \
            "https://caddyserver.com/api/download?os=linux&arch=$(dpkg --print-architecture)&p=${caddy_plugin}@${caddy_plugin_version}" \
            && chmod 0755 "$caddy_download" && caddy_has_plugin "$caddy_download"; then
        mv "$caddy_download" "$caddy_custom"
        caddy_binary_changed=true
    elif [ -x "$caddy_custom" ] && "$caddy_custom" list-modules 2>/dev/null | grep '^http.handlers.replace_response$' >/dev/null; then
        echo "WARNING: Could not download Caddy with ${caddy_plugin}@${caddy_plugin_version}; keeping the existing $caddy_custom" >&2
    else
        echo "ERROR: Could not download Caddy with ${caddy_plugin}@${caddy_plugin_version} from caddyserver.com and no usable $caddy_custom exists" >&2
        rm -f "$caddy_download"
        exit 1
    fi
    rm -f "$caddy_download"
fi

if [ -z "$(dpkg-divert --list /usr/bin/caddy)" ]; then
    dpkg-divert --divert /usr/bin/caddy.default --rename /usr/bin/caddy
fi
update-alternatives --install /usr/bin/caddy caddy /usr/bin/caddy.default 10
update-alternatives --install /usr/bin/caddy caddy "$caddy_custom" 50
update-alternatives --set caddy "$caddy_custom"
echo "Using $(caddy version)"


##############
## Authelia ##
##############


if [ ! -d "$authelia_persistent_dir" ]; then
    mkdir -p $authelia_persistent_dir
fi
chown authelia:authelia $authelia_persistent_dir

# Update docker to use fuse-overlayfs (required to use overlayfs as backing filesystem for docker as overlayfs-on-overlayfs isn't supported)
if [ ! -f /etc/docker/daemon.json ]; then
    cat <<EOF > /etc/docker/daemon.json
{
  "storage-driver": "fuse-overlayfs"
}
EOF
    systemctl restart docker
fi

# Everything Authelia reads at startup, so we can restart it below only when
# this run changed something (a restart signs everyone out: sessions are in memory)
authelia_inputs_fingerprint() {
    cat /etc/authelia/configuration.yml \
        /etc/systemd/system/authelia.service.d/override.conf \
        /etc/authelia/smtp_password 2>/dev/null | sha256sum || true
}
authelia_inputs_before=$(authelia_inputs_fingerprint)

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

# An SSM parameter ARN names its own region, which may not be ours
smtp_credentials_region=$jaia_aws_region
if [[ "$smtp_credentials_parameter" == arn:* ]]; then
    smtp_credentials_region=$(cut -d: -f4 <<< "$smtp_credentials_parameter")
fi

smtp_password_file=/etc/authelia/smtp_password
smtp_username_line=""
smtp_password_env=""
if smtp_credentials=$(aws ssm get-parameter --region "$smtp_credentials_region" --name "$smtp_credentials_parameter" --with-decryption --query Parameter.Value --output text) \
        && smtp_username=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["username"])' <<< "$smtp_credentials") \
        && smtp_password=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["password"])' <<< "$smtp_credentials"); then
    (umask 077; printf '%s' "$smtp_password" > "$smtp_password_file")
    chown authelia:authelia "$smtp_password_file"
    smtp_username_line="username: '$smtp_username'"
    smtp_password_env="Environment=AUTHELIA_NOTIFIER_SMTP_PASSWORD_FILE=$smtp_password_file"
else
    # Not fatal: an IP-allowlisted relay (e.g. Google Workspace) needs no credentials
    echo "WARNING: Could not read SMTP credentials from SSM parameter $smtp_credentials_parameter ($smtp_credentials_region). Authelia will send without authenticating." >&2
    rm -f "$smtp_password_file"
fi

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
    # The navigation menu asks Caddy who is signed in (/_jaia/whoami on every site)
    - domain:
        - '$base_uri'
        - '*.$base_uri'
      resources:
        - '^/_jaia/whoami$'
      policy: two_factor

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

    # Landing page listing the sites
    - domain: $base_uri
      policy: 'two_factor'

session:
  secret: '$session_secret'
  inactivity: '15m'
  expiration: '2h'
  cookies:
     - domain: '$base_uri'
       authelia_url: 'https://auth.$base_uri'
       default_redirection_url: 'https://$base_uri/'
storage:
  encryption_key: '$storage_encryption_key'
  local:
    path: '$authelia_persistent_dir/db.sqlite3'
notifier:
  smtp:
    address: '$smtp_address'
    $smtp_username_line
    sender: 'Jaia <$smtp_sender>'
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
{
        # replace-response plugin (custom build, see above)
        order replace after encode
}

(authelia_forward_auth) {
        forward_auth localhost:$authelia_port {
                uri /api/authz/forward-auth
                copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
        }
}

# Shared navigation menu and landing page (static files from jaiabot-web)
(jaia_nav) {
        # Who is signed in, for the menu. forward_auth sets the Remote-* headers
        # and respond runs after it, so these are Authelia's values, not the client's.
        handle /_jaia/whoami {
                import authelia_forward_auth
                header Cache-Control no-store
                header Content-Type "text/plain; charset=utf-8"
                respond <<WHOAMI
{http.request.header.Remote-User}
{http.request.header.Remote-Name}
{http.request.header.Remote-Groups}
WHOAMI 200
        }

        # Public (nothing sensitive) so the sign-in page can show the menu too
        handle /_jaia/* {
                root * $jaia_cloud_web_dir
                header Cache-Control "public, max-age=300"
                file_server
        }
}

# Proxy to an upstream, injecting the navigation into every HTML page
(jaia_nav_proxy) {
        # replace cannot read compressed bodies, so the upstream must send them
        # uncompressed; encode compresses for the client instead
        encode zstd gzip
        replace {
                match {
                        header Content-Type text/html*
                }
                re "(?i)</head>" "<link rel=\"stylesheet\" href=\"/_jaia/nav.css\"><script defer src=\"/_jaia/nav.js\"></script></head>"
        }
        reverse_proxy {args[0]} {
                header_up Accept-Encoding identity
        }
}

# Landing page
$base_uri {
        import jaia_nav
        handle {
                import authelia_forward_auth
                root * $jaia_cloud_web_dir
                encode zstd gzip
                file_server
        }
}

# Authelia Portal.
auth.$base_uri {
        import jaia_nav
        handle {
                import jaia_nav_proxy localhost:$authelia_port
        }
}

users.$base_uri {
        import jaia_nav
        handle {
                import authelia_forward_auth
                import jaia_nav_proxy :$lldap_web_port
        }
}

# Runtime JCC
run.$base_uri {
        import jaia_nav
        handle {
                import authelia_forward_auth
                import jaia_nav_proxy [$ch_ip]:$jcc_port
        }
}

# VirtualFleet JCC
sim.$base_uri {
        import jaia_nav
        handle {
                import authelia_forward_auth
                import jaia_nav_proxy [$vh1_ip]:80
        }
}

EOF

# Caddy starts with its stock Caddyfile when installed, so reload to apply ours
# (graceful if running). The running process cannot reload into a new binary,
# and a stock binary rejects 'replace', so restart when the binary changed.
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
if $caddy_binary_changed; then
    systemctl restart caddy
else
    systemctl reload-or-restart caddy
fi

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
)

# Create group config files
for group in "${groups[@]}"; do
    cat > "/etc/lldap/bootstrap/group-configs/${group}.json" <<EOF
{
  "name": "${group}"
}
EOF
done

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

if ! $jaia_auth_lldap_bootstrap_completed; then
    # Run the bootstrap script
    until docker compose -f /etc/lldap/docker-compose.yaml exec lldap /app/bootstrap.sh; do sleep 1; done
    echo "jaia_auth_lldap_bootstrap_completed=true" >> /etc/jaiabot/cloud.env
fi

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
$smtp_password_env
EOF

systemctl daemon-reload
# Authelia only reads its configuration at startup, so 'start' alone would leave a
# running instance enforcing the old access_control rules
if [ "$(authelia_inputs_fingerprint)" != "$authelia_inputs_before" ]; then
    systemctl restart authelia
else
    systemctl start authelia
fi


##############
## Firewall ##
##############

# Add firewall to UFW (AWS done at CloudHub creation time)
ufw allow in on eth0 to any port 80 proto tcp
ufw allow in on eth0 to any port 443 proto tcp
