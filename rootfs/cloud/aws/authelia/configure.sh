#!/bin/bash

set -u -e -o pipefail

## This script must be idempotent!!
# (Re)configures Authelia, LLDAP and Caddy (from jaiabot-web-thirdparty) and the WireGuard
# tunnel to the upstreams on the auth.cloud.jaia.tech server. deploy.sh installs and runs it.

set -a
source "${AUTH_SERVER_ENV:-/etc/jaiabot/auth-server.env}"
set +a

share_dir=/usr/local/share/jaia-auth-server
source "${JAIA_AUTHELIA_COMMON:-$share_dir/jaia-authelia-common.sh}"

base_uri=$AUTH_BASE_DOMAIN

lldap_ldap_port=3890
lldap_web_port=17170
authelia_port=9091
authelia_address="tcp://127.0.0.1:$authelia_port"
wg_listen_port=51820
wg_interface=wg_jaia_upstreams

state_dir=/var/lib/jaia-auth-server
secrets_file=$state_dir/secrets
authelia_persistent_dir=/var/lib/authelia
lldap_persistent_dir=/var/lib/lldap
lldap_http_url="https://lldap.$base_uri"
jaia_cloud_web_dir=$share_dir/web

jaia_aws_region=$AWS_REGION
smtp_credentials_parameter=$AUTH_SMTP_CREDENTIALS_PARAMETER
smtp_password_file=/etc/authelia/smtp_password
smtp_address=$AUTH_SMTP_ADDRESS
smtp_sender=$AUTH_SMTP_SENDER
notifier_startup_check="disable_startup_check: false"


#############
## Secrets ##
#############

# migrate-from.sh replaces the ones that existing accounts depend on before this runs
load_secrets()
{
    mkdir -p "$state_dir"
    chmod 0700 "$state_dir"
    load_secrets_file "$secrets_file"
}

# Postmark refuses unauthenticated mail
load_postmark_credentials()
{
    if ! load_smtp_credentials; then
        echo "ERROR: could not read the SMTP credentials from SSM parameter $smtp_credentials_parameter" >&2
        exit 1
    fi
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
  "email": "authelia@$base_uri",
  "displayName": "Authelia",
  "password_file": "$dir/authelia_password",
  "groups": ["lldap_admin"]
}
EOF

    if ! lldap_bootstrap admin "$lldap_admin_password" "$dir" > /dev/null; then
        rm -rf "$dir"
        echo "ERROR: could not add the authelia admin to LLDAP" >&2
        exit 1
    fi
    rm -rf "$dir"
}


##############
## Authelia ##
##############

authelia_config()
{
    authelia_config_head
    cat <<EOF
    # Test runners post their results without signing in
    - domain: cc.$base_uri
      resources:
        - '^/test-results/api/submit/$'
      policy: bypass

    - domain: lldap.$base_uri
      subject: 'group:lldap_admin'
      policy: two_factor

    - domain:
        - cc.$base_uri
        - sandbox.cc.$base_uri
        - launchpad.$base_uri
      subject: 'group:cc_db'
      policy: two_factor

    - domain: data.$base_uri
      subject: 'group:data'
      policy: two_factor

session:
  secret: '$session_secret'
  inactivity: '1h'
  expiration: '12h'
  remember_me: '1M'
  cookies:
    - domain: '$base_uri'
      authelia_url: 'https://auth.$base_uri'
EOF
    authelia_config_tail
}

write_authelia_config()
{
    mkdir -p "$authelia_persistent_dir"
    chown -R authelia:authelia "$authelia_persistent_dir"
    chmod 0700 "$authelia_persistent_dir"

    authelia_config > /etc/authelia/configuration.yml
    chown authelia:authelia /etc/authelia/configuration.yml
    chmod 0600 /etc/authelia/configuration.yml

    systemctl enable authelia
}


###########
## Caddy ##
###########

caddyfile()
{
    local acme_ca=""
    if [ -n "$CADDY_ACME_CA" ]; then
        acme_ca="acme_ca $CADDY_ACME_CA"
    fi

    cat <<EOF
{
        $acme_ca
}

$(caddy_authelia_snippets)

(authelia_proxy) {
        reverse_proxy localhost:$authelia_port
}

# Static pages Caddy serves itself
(jaia_static) {
        handle /_jaia/* {
                root * $jaia_cloud_web_dir
                header Cache-Control no-cache
                file_server
        }
}

auth.$base_uri {
        import jaia_static
        import authelia_portal authelia_proxy
}

lldap.$base_uri {
        import authelia_forward_auth
        reverse_proxy 127.0.0.1:$lldap_web_port
}

cc.$base_uri, sandbox.cc.$base_uri, launchpad.$base_uri {
        import authelia_forward_auth
        reverse_proxy [$CC_DB_WG_ADDRESS]:80
}

data.$base_uri {
        import authelia_forward_auth
        reverse_proxy [$DATA_WG_ADDRESS]:80
}
EOF
}

write_caddyfile()
{
    caddyfile > /etc/caddy/Caddyfile
    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
}

# Caddy starts with its stock Caddyfile when installed, so reload to apply ours
start_caddy()
{
    systemctl enable caddy
    if $caddy_binary_changed; then
        systemctl restart caddy
    else
        systemctl reload-or-restart caddy
    fi
}


##########
## Main ##
##########

main()
{
    install_web_thirdparty

    load_secrets
    # Before anything Authelia reads at startup is rewritten, the SMTP password included
    authelia_inputs_before=$(authelia_inputs_fingerprint)
    load_postmark_credentials

    configure_wireguard

    start_lldap
    bootstrap_authelia_account

    write_authelia_config
    start_authelia

    write_caddyfile
    start_caddy

    echo "WireGuard public key for the upstreams: $wireguard_public_key"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
