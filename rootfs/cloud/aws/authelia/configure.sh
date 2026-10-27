#!/bin/bash

set -u -e -o pipefail

## This script must be idempotent!!
# (Re)configures Authelia, LLDAP and Caddy (from jaiabot-web-thirdparty) and the WireGuard
# tunnel to the upstreams on the auth.cloud.jaia.tech server. deploy.sh installs and runs it.

set -a
source /etc/jaiabot/auth-server.env
set +a

base=$AUTH_BASE_DOMAIN

lldap_ldap_port=3890
lldap_web_port=17170
authelia_port=9091
wg_listen_port=51820
wg_interface=wg_jaia_upstreams

state_dir=/var/lib/jaia-auth-server
secrets_file=$state_dir/secrets
authelia_dir=/var/lib/authelia
lldap_dir=/var/lib/lldap
web_dir=/usr/local/share/jaia-auth-server/web
smtp_password_file=/etc/authelia/smtp_password


#############
## Secrets ##
#############

# Made once and kept with the data they protect. migrate-from.sh replaces the ones that
# existing accounts depend on before this runs.
load_secrets()
{
    mkdir -p "$state_dir"
    chmod 0700 "$state_dir"
    local name
    for name in jwt_secret session_secret storage_encryption_key lldap_jwt_secret lldap_key_seed \
                authelia_ldap_password; do
        if ! grep -q "^$name=" "$secrets_file" 2>/dev/null; then
            echo "$name=$(openssl rand -hex 64)" >> "$secrets_file"
        fi
    done
    chmod 0600 "$secrets_file"
    set -a; source "$secrets_file"; set +a
}

# Postmark refuses unauthenticated mail, and Authelia will not start without its relay
load_smtp_credentials()
{
    local credentials
    credentials=$(aws ssm get-parameter --region "$AWS_REGION" --name "$AUTH_SMTP_CREDENTIALS_PARAMETER" \
                      --with-decryption --query Parameter.Value --output text)
    smtp_username=$(jq -r .username <<< "$credentials")
    (umask 077; jq -j .password <<< "$credentials" > "$smtp_password_file")
    chown authelia:authelia "$smtp_password_file"
}


###############
## WireGuard ##
###############

# The private key lives in SSM so a rebuilt server keeps it, and the upstreams' peer entries with it
wireguard_private_key()
{
    local err key
    err=$(mktemp)
    if key=$(aws ssm get-parameter --region "$AWS_REGION" --name "$AUTH_WG_PRIVATE_KEY_PARAMETER" \
                 --with-decryption --query Parameter.Value --output text 2> "$err"); then
        rm -f "$err"
        echo "$key"
    elif grep -q ParameterNotFound "$err"; then
        key=$(wg genkey)
        # A file, so the key is never on a command line
        (umask 077; printf '%s' "$key" > "$err")
        aws ssm put-parameter --region "$AWS_REGION" --name "$AUTH_WG_PRIVATE_KEY_PARAMETER" \
            --type SecureString --value "file://$err" > /dev/null
        rm -f "$err"
        echo "$key"
    else
        cat "$err" >&2
        rm -f "$err"
        return 1
    fi
}

wireguard_peer()
{
    local name=$1 public_key=$2 address=$3 endpoint=$4
    if [ -z "$public_key" ]; then
        echo "WARNING: no WireGuard public key for $name yet; run upstream-peer.sh for it" >&2
        return
    fi
    cat <<EOF

# $name
[Peer]
PublicKey = $public_key
AllowedIPs = $address/128
Endpoint = [$endpoint]:$wg_listen_port
EOF
}

configure_wireguard()
{
    local conf=/etc/wireguard/$wg_interface.conf
    local private_key
    private_key=$(wireguard_private_key)
    wireguard_public_key=$(wg pubkey <<< "$private_key")

    (umask 077; {
        cat <<EOF
[Interface]
PrivateKey = $private_key
Address = $AUTH_WG_ADDRESS/64
EOF
        wireguard_peer cc_db "$CC_DB_WG_PUBLIC_KEY" "$CC_DB_WG_ADDRESS" "$CC_DB_WG_ENDPOINT"
        wireguard_peer data "$DATA_WG_PUBLIC_KEY" "$DATA_WG_ADDRESS" "$DATA_WG_ENDPOINT"
    } > "$conf.new")

    if ! cmp -s "$conf.new" "$conf"; then
        mv "$conf.new" "$conf"
        systemctl enable wg-quick@$wg_interface
        systemctl restart wg-quick@$wg_interface
    else
        rm "$conf.new"
        systemctl enable --now wg-quick@$wg_interface
    fi
}


###########
## LLDAP ##
###########

start_lldap()
{
    mkdir -p "$lldap_dir"
    chown -R lldap:lldap "$lldap_dir"
    chmod 0700 "$lldap_dir"

    local before
    before=$(sha256sum /etc/lldap/lldap_config.toml 2>/dev/null || true)
    # LLDAP creates this admin only in a directory that has none, as on a CloudHub
    cat <<EOF > /etc/lldap/lldap_config.toml
ldap_host = "127.0.0.1"
ldap_port = $lldap_ldap_port
http_host = "127.0.0.1"
http_port = $lldap_web_port
http_url = "https://lldap.$base"
jwt_secret = "$lldap_jwt_secret"
key_seed = "$lldap_key_seed"
ldap_base_dn = "dc=jaia,dc=tech"
ldap_user_dn = "authelia"
ldap_user_email = "authelia@$base"
ldap_user_pass = "$authelia_ldap_password"
database_url = "sqlite://$lldap_dir/users.db?mode=rwc"
EOF
    chown root:lldap /etc/lldap/lldap_config.toml
    chmod 0640 /etc/lldap/lldap_config.toml

    systemctl enable lldap
    # LLDAP reads its configuration at startup only
    if [ "$(sha256sum /etc/lldap/lldap_config.toml)" != "$before" ]; then
        systemctl restart lldap
    else
        systemctl start lldap
    fi
}

# A migrated directory already has admins, so LLDAP does not create the authelia admin there;
# the admin login migrate-from.sh brings across adds it.
bootstrap_authelia_account()
{
    if [ -z "${lldap_admin_password:-}" ]; then
        return
    fi
    local dir
    dir=$(mktemp -d)
    mkdir -p "$dir/user-configs" "$dir/group-configs" "$dir/user-schemas" "$dir/group-schemas"
    (umask 077; printf '%s' "$authelia_ldap_password" > "$dir/authelia_password")
    cat > "$dir/user-configs/authelia.json" <<EOF
{
  "id": "authelia",
  "email": "authelia@$base",
  "displayName": "Authelia",
  "password_file": "$dir/authelia_password",
  "groups": ["lldap_admin"]
}
EOF

    # bounded, for an LLDAP that never comes up
    local attempt
    for attempt in $(seq 1 120); do
        if LLDAP_URL=http://127.0.0.1:$lldap_web_port \
           LLDAP_ADMIN_USERNAME=admin \
           LLDAP_ADMIN_PASSWORD="$lldap_admin_password" \
           USER_CONFIGS_DIR=$dir/user-configs \
           GROUP_CONFIGS_DIR=$dir/group-configs \
           USER_SCHEMAS_DIR=$dir/user-schemas \
           GROUP_SCHEMAS_DIR=$dir/group-schemas \
           LLDAP_SET_PASSWORD_PATH=/usr/bin/lldap_set_password \
           DO_CLEANUP=false \
           /usr/libexec/lldap/bootstrap.sh > /dev/null; then
            rm -rf "$dir"
            return
        fi
        sleep 1
    done
    rm -rf "$dir"
    echo "ERROR: could not add the authelia admin to LLDAP after ${attempt} attempts" >&2
    exit 1
}


##############
## Authelia ##
##############

# Everything Authelia reads at startup, so it restarts only when this run changed
# something (a restart signs everyone out: sessions are in memory)
authelia_inputs_fingerprint()
{
    cat /etc/authelia/configuration.yml \
        /etc/systemd/system/authelia.service.d/override.conf \
        "$smtp_password_file" 2>/dev/null | sha256sum || true
}

write_authelia_config()
{
    mkdir -p "$authelia_dir"
    chown -R authelia:authelia "$authelia_dir"
    chmod 0700 "$authelia_dir"

    cat <<EOF > /etc/authelia/configuration.yml
---
server:
  address: 'tcp://127.0.0.1:$authelia_port'
  # Whole offices reach this server from one address
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
default_2fa_method: ''
webauthn:
  disable: false
  enable_passkey_login: false
  display_name: '$base'
totp:
  disable: false
  issuer: '$base'
duo_api:
  disable: true
identity_validation:
  reset_password:
    jwt_secret: '$jwt_secret'
authentication_backend:
  ldap:
    implementation: 'lldap'
    address: 'ldap://127.0.0.1:$lldap_ldap_port'
    base_dn: 'DC=jaia,DC=tech'
    user: 'UID=authelia,OU=people,DC=jaia,DC=tech'
    password: '$authelia_ldap_password'
access_control:
  default_policy: 'deny'
  rules: # order matters!
    # Cancel links in Authelia's emails work only for someone signed in, which a mail scanner never is
    - domain: auth.$base
      resources:
        - '^/revoke/(reset-password|one-time-code)([?].*)?$'
        - '^/api/reset-password$'
        - '^/api/user/session/elevation/[^/]+$'
      policy: one_factor

    # Test runners post their results without signing in
    - domain: cc.$base
      resources:
        - '^/test-results/api/submit/$'
      policy: bypass

    - domain: lldap.$base
      subject: 'group:lldap_admin'
      policy: two_factor

    - domain:
        - cc.$base
        - sandbox.cc.$base
        - launchpad.$base
      subject: 'group:cc_db'
      policy: two_factor

    - domain: data.$base
      subject: 'group:data'
      policy: two_factor

session:
  secret: '$session_secret'
  inactivity: '1h'
  expiration: '12h'
  remember_me: '1M'
  cookies:
    - domain: '$base'
      authelia_url: 'https://auth.$base'
storage:
  encryption_key: '$storage_encryption_key'
  local:
    path: '$authelia_dir/db.sqlite3'
notifier:
  disable_startup_check: false
  smtp:
    address: '$AUTH_SMTP_ADDRESS'
    username: '$smtp_username'
    sender: 'Jaia <$AUTH_SMTP_SENDER>'
    identifier: 'auth.$base'
    subject: '[Jaia Cloud] {title}'
...
EOF
    chown authelia:authelia /etc/authelia/configuration.yml
    chmod 0600 /etc/authelia/configuration.yml

    systemctl enable authelia
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
Environment=AUTHELIA_NOTIFIER_SMTP_PASSWORD_FILE=$smtp_password_file
EOF

    systemctl daemon-reload
    # Authelia only reads its configuration at startup
    if [ "$(authelia_inputs_fingerprint)" != "$authelia_inputs_before" ]; then
        systemctl restart authelia
    else
        systemctl start authelia
    fi
}


###########
## Caddy ##
###########

write_caddyfile()
{
    local acme_ca=""
    if [ -n "$CADDY_ACME_CA" ]; then
        acme_ca="acme_ca $CADDY_ACME_CA"
    fi

    cat <<EOF > /etc/caddy/Caddyfile
{
        $acme_ca
}

(authelia_forward_auth) {
        forward_auth localhost:$authelia_port {
                uri /api/authz/forward-auth
                copy_headers Remote-User Remote-Groups Remote-Email Remote-Name
                # A denial carries a fresh anonymous session cookie, which would
                # replace a sign-in that completed while the request was in flight
                header_down -Set-Cookie
        }
}

(authelia_proxy) {
        reverse_proxy localhost:$authelia_port
}

# Static pages Caddy serves itself
(jaia_static) {
        handle /_jaia/* {
                root * $web_dir
                header Cache-Control no-cache
                file_server
        }
}

# Authelia Portal.
auth.$base {
        import jaia_static
        # Mail scanners open the links in Authelia's emails, and press buttons, before the
        # person does. A reset link spends its token in whichever browser opens it, so it
        # only reaches Authelia from the browser that asked for the reset.
        @reset_requested {
                method POST
                path /api/reset-password/identity/start
        }
        handle @reset_requested {
                header +Set-Cookie "jaia_reset=1; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax"
                import authelia_proxy
        }
        @reset_link_elsewhere {
                method GET
                path /reset-password/step2
                not header Cookie *jaia_reset=1*
        }
        handle @reset_link_elsewhere {
                root * $web_dir
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
                import authelia_proxy
        }
        @cancel_call {
                method DELETE
                path /api/reset-password /api/user/session/elevation/*
        }
        handle @cancel_call {
                import authelia_forward_auth
                import authelia_proxy
        }
        handle {
                import authelia_proxy
        }
}

lldap.$base {
        import authelia_forward_auth
        reverse_proxy 127.0.0.1:$lldap_web_port
}

cc.$base, sandbox.cc.$base, launchpad.$base {
        import authelia_forward_auth
        reverse_proxy [$CC_DB_WG_ADDRESS]:80
}

data.$base {
        import authelia_forward_auth
        reverse_proxy [$DATA_WG_ADDRESS]:80
}
EOF

    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
}

# Caddy starts with its stock Caddyfile when installed, so reload to apply ours. A running
# Caddy cannot reload into a binary apt has since replaced, so restart if reload fails.
start_caddy()
{
    systemctl enable caddy
    if ! systemctl reload-or-restart caddy; then
        systemctl restart caddy
    fi
}


##########
## Main ##
##########

main()
{
    load_secrets
    # Before anything Authelia reads at startup is rewritten, the SMTP password included
    authelia_inputs_before=$(authelia_inputs_fingerprint)
    load_smtp_credentials

    configure_wireguard

    start_lldap
    bootstrap_authelia_account

    write_authelia_config
    start_authelia

    write_caddyfile
    start_caddy

    echo "WireGuard public key for the upstreams: $wireguard_public_key"
}

main "$@"
