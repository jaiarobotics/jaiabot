# Sourced, not run: the Authelia, LLDAP and Caddy setup a CloudHub (jaia_configure_authelia.sh)
# shares with the auth.cloud.jaia.tech server (rootfs/cloud/aws/authelia/configure.sh).
#
# The sourcing script sets:
#   base_uri                   the domain whose auth.<base_uri> is the sign-in page
#   authelia_address           where Authelia listens, e.g. tcp://127.0.0.1:9091
#   authelia_port lldap_ldap_port lldap_web_port
#   authelia_persistent_dir    Authelia's database
#   authelia_asset_dir         optional portal branding
#   lldap_persistent_dir       LLDAP's database
#   lldap_http_url             optional URL of LLDAP's own pages
#   swapfile                   optional, swapped on before LLDAP starts
#   jaia_cloud_web_dir         holds _jaia/reset-elsewhere.html and what it links to
#   jaia_aws_region smtp_credentials_parameter smtp_password_file smtp_address smtp_sender
#   notifier_startup_check     disable_startup_check: true|false


##############
## Packages ##
##############

install_web_thirdparty()
{
    apt-get update && apt-get install -y --no-upgrade jaiabot-web-thirdparty

    # Not grep -q: under pipefail it exits on the first match and caddy dies of SIGPIPE
    if ! caddy list-modules 2>/dev/null | grep -x http.handlers.replace_response > /dev/null; then
        echo "ERROR: $(command -v caddy) lacks the replace_response module; is jaiabot-web-thirdparty installed?" >&2
        exit 1
    fi
    echo "Using $(caddy version)"

    # A running Caddy cannot reload into a binary apt has since replaced
    caddy_binary_changed=false
    local caddy_pid
    caddy_pid=$(systemctl show -p MainPID --value caddy 2>/dev/null || echo 0)
    if [ "${caddy_pid:-0}" != 0 ] && [ "$(readlink "/proc/$caddy_pid/exe" 2>/dev/null)" != /usr/bin/caddy ]; then
        caddy_binary_changed=true
    fi
}


#############
## Secrets ##
#############

# Made once and kept with the data they protect
load_secrets_file()
{
    local file=$1 name
    for name in jwt_secret session_secret storage_encryption_key lldap_jwt_secret lldap_key_seed \
                authelia_ldap_password; do
        if ! grep -q "^$name=" "$file" 2>/dev/null; then
            echo "$name=$(openssl rand -hex 64)" >> "$file"
        fi
    done
    chmod 0600 "$file"
    set -a; source "$file"; set +a
}

# Fails, leaving Authelia to send without authenticating, when the parameter cannot be read
load_smtp_credentials()
{
    # An SSM parameter ARN names its own region, which may not be ours
    local region=$jaia_aws_region
    if [[ "$smtp_credentials_parameter" == arn:* ]]; then
        region=$(cut -d: -f4 <<< "$smtp_credentials_parameter")
    fi

    local credentials username password
    smtp_username_line=""
    smtp_password_env=""
    if credentials=$(aws ssm get-parameter --region "$region" --name "$smtp_credentials_parameter" --with-decryption --query Parameter.Value --output text) \
            && username=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["username"])' <<< "$credentials") \
            && password=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["password"])' <<< "$credentials"); then
        (umask 077; printf '%s' "$password" > "$smtp_password_file")
        chown authelia:authelia "$smtp_password_file"
        smtp_username_line="username: '$username'"
        smtp_password_env="Environment=AUTHELIA_NOTIFIER_SMTP_PASSWORD_FILE=$smtp_password_file"
    else
        rm -f "$smtp_password_file"
        return 1
    fi
}


##############
## Authelia ##
##############

# Everything Authelia reads at startup, so we can restart it below only when
# this run changed something (a restart signs everyone out: sessions are in memory)
authelia_inputs_fingerprint()
{
    cat /etc/authelia/configuration.yml \
        /etc/systemd/system/authelia.service.d/override.conf \
        "$smtp_password_file" 2>/dev/null | sha256sum || true
}

# configuration.yml up to the sourcing script's own access rules
authelia_config_head()
{
    cat <<EOF
---
server:
  address: '$authelia_address'
EOF
    if [ -n "${authelia_asset_dir:-}" ]; then
        echo "  asset_path: '$authelia_asset_dir'"
    fi
    cat <<EOF
  # A whole office usually reaches the sign-in page from one address
  endpoints:
    rate_limits:
      reset_password_start:
        buckets:
          - period: '5 minutes'
            requests: 20
          - period: '1 hour'
            requests: 100
      session_elevation_start:
        buckets:
          - period: '5 minutes'
            requests: 20
          - period: '1 hour'
            requests: 100
# Blank: a user with no stored preference is offered the method they registered
# (TOTP, then a security key); a named default would be offered first regardless
default_2fa_method: ''
webauthn:
  disable: false
  enable_passkey_login: false
  display_name: '$base_uri'
totp:
  disable: false
  issuer: '$base_uri'
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
    user: 'UID=authelia,OU=people,DC=jaia,DC=tech'
    password: '$authelia_ldap_password'
access_control:
  default_policy: 'deny'
  rules: # order matters!
    # Cancel links in Authelia's emails work only for someone signed in, which a mail scanner never is
    - domain: auth.$base_uri
      resources:
        - '^/revoke/(reset-password|one-time-code)([?].*)?$'
        - '^/api/reset-password$'
        - '^/api/user/session/elevation/[^/]+$'
      policy: one_factor

EOF
}

# configuration.yml after the sourcing script's session
authelia_config_tail()
{
    cat <<EOF
storage:
  encryption_key: '$storage_encryption_key'
  local:
    path: '$authelia_persistent_dir/db.sqlite3'
notifier:
  $notifier_startup_check
  smtp:
    address: '$smtp_address'
    $smtp_username_line
    sender: 'Jaia <$smtp_sender>'
    identifier: 'auth.$base_uri'
    subject: '[Jaia Cloud] {title}'
...
EOF
}

# Started after LLDAP, which it authenticates against
start_authelia()
{
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
}


###########
## Caddy ##
###########

# The auth site imports authelia_portal with the snippet, and its arguments, that proxies to Authelia
caddy_authelia_snippets()
{
    cat <<EOF
(authelia_forward_auth) {
        forward_auth localhost:$authelia_port {
                uri /api/authz/forward-auth
                copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
                # A denial carries a fresh anonymous session cookie, which would
                # replace a sign-in that completed while the request was in flight
                header_down -Set-Cookie
        }
}

# Mail scanners open the links in Authelia's emails, and press buttons, before the
# person does. A reset link spends its token in whichever browser opens it, so it
# only reaches Authelia from the browser that asked for the reset.
(authelia_portal) {
        @reset_requested {
                method POST
                path /api/reset-password/identity/start
        }
        handle @reset_requested {
                header +Set-Cookie "jaia_reset=1; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax"
                import {args[:]}
        }
        @reset_link_elsewhere {
                method GET
                path /reset-password/step2
                not header Cookie *jaia_reset=1*
        }
        handle @reset_link_elsewhere {
                root * $jaia_cloud_web_dir
                rewrite * /_jaia/reset-elsewhere.html
                header Cache-Control no-store
                file_server
        }
        @reset_finish_elsewhere {
                path /api/reset-password/identity/finish
                not header Cookie *jaia_reset=1*
        }
        handle @reset_finish_elsewhere {
                respond 403
        }
        # A cancel link acts as it loads, so only for someone signed in
        @cancel_link {
                method GET
                path /revoke/reset-password /revoke/one-time-code
        }
        handle @cancel_link {
                import authelia_forward_auth
                import {args[:]}
        }
        @cancel_call {
                method DELETE
                path /api/reset-password /api/user/session/elevation/*
        }
        handle @cancel_call {
                import authelia_forward_auth
                import {args[:]}
        }
        handle {
                import {args[:]}
        }
}
EOF
}


###########
## LLDAP ##
###########

lldap_inputs_fingerprint()
{
    cat /etc/lldap/lldap_config.toml /etc/systemd/system/lldap.service.d/jaia-swap.conf 2>/dev/null | sha256sum || true
}

lldap_config()
{
    cat <<EOF
ldap_host = "127.0.0.1"
ldap_port = $lldap_ldap_port
http_host = "127.0.0.1"
http_port = $lldap_web_port
EOF
    if [ -n "${lldap_http_url:-}" ]; then
        echo "http_url = \"$lldap_http_url\""
    fi
    cat <<EOF
jwt_secret = "$lldap_jwt_secret"
key_seed = "$lldap_key_seed"
ldap_base_dn = "dc=jaia,dc=tech"
ldap_user_dn = "authelia"
ldap_user_email = "authelia@$base_uri"
ldap_user_pass = "$authelia_ldap_password"
database_url = "sqlite://$lldap_persistent_dir/users.db?mode=rwc"
EOF
}

# LLDAP creates its authelia admin only in a directory that has no admin yet
start_lldap()
{
    # An LLDAP configured before jaiabot-web-thirdparty ran in Docker from a unit written
    # here, which would shadow the package's
    if [ -f /etc/systemd/system/lldap.service ]; then
        systemctl disable --now lldap || true
        rm -f /etc/systemd/system/lldap.service /etc/lldap/docker-compose.yaml
        systemctl daemon-reload
    fi

    # recursive: this directory may outlive the rootfs, and the lldap uid differs between images
    mkdir -p "$lldap_persistent_dir"
    chown -R lldap:lldap $lldap_persistent_dir

    local before
    before=$(lldap_inputs_fingerprint)

    lldap_config > /etc/lldap/lldap_config.toml
    chown root:lldap /etc/lldap/lldap_config.toml
    chmod 0640 /etc/lldap/lldap_config.toml

    if [ -n "${swapfile:-}" ]; then
        # overlayroot won't allow a swapfile in /etc/fstab, so it is started here
        mkdir -p /etc/systemd/system/lldap.service.d
        cat <<EOF > /etc/systemd/system/lldap.service.d/jaia-swap.conf
[Service]
ExecStartPre=-+/usr/sbin/swapon $swapfile
EOF
    fi
    systemctl daemon-reload
    systemctl enable lldap
    # LLDAP reads its configuration at startup only
    if [ "$(lldap_inputs_fingerprint)" != "$before" ]; then
        systemctl restart lldap
    else
        systemctl start lldap
    fi
}

# bootstrap.sh as admin_user, from config_dir/{user,group}-{configs,schemas}. Bounded, for an
# LLDAP that never comes up.
lldap_bootstrap()
{
    local admin_user=$1 admin_password=$2 config_dir=$3 attempt
    for attempt in $(seq 1 120); do
        if LLDAP_URL=http://127.0.0.1:$lldap_web_port \
           LLDAP_ADMIN_USERNAME=$admin_user \
           LLDAP_ADMIN_PASSWORD="$admin_password" \
           USER_CONFIGS_DIR=$config_dir/user-configs \
           GROUP_CONFIGS_DIR=$config_dir/group-configs \
           USER_SCHEMAS_DIR=$config_dir/user-schemas \
           GROUP_SCHEMAS_DIR=$config_dir/group-schemas \
           LLDAP_SET_PASSWORD_PATH=/usr/bin/lldap_set_password \
           DO_CLEANUP=false \
           /usr/libexec/lldap/bootstrap.sh; then
            return 0
        fi
        sleep 1
    done
    return 1
}
