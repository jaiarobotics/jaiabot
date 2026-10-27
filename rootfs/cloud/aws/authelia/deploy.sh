#!/bin/bash
# Installs configure.sh, its settings and static pages on an auth server and runs it.
# Run again after changing any of them: this, not editing the server, is how it changes.

set -u -e -o pipefail

if (( $# < 1 || $# > 2 )); then
    echo "Usage: $0 authelia/authelia.conf [ssh-host]"
    echo "ssh-host defaults to the conf's SERVER_NAME; set SSH_OPTS for extra ssh options"
    exit 1
fi

# The conf is written relative to rootfs/cloud/aws, as create_specialty_server.sh sources it
SCRIPT_PATH=$(cd "$(dirname "$0")/.." && pwd)
HERE=$SCRIPT_PATH/authelia
WEB=$SCRIPT_PATH/../../../src/web/cloud/_jaia
set -a; source "$1"; set +a
host=${2:-$SERVER_NAME}
SSH_OPTS=${SSH_OPTS:-}

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

cat > "$stage/auth-server.env" <<EOF
AWS_REGION=$REGION
AUTH_BASE_DOMAIN=$AUTH_BASE_DOMAIN
CADDY_ACME_CA=$CADDY_ACME_CA
AUTH_SMTP_ADDRESS=$AUTH_SMTP_ADDRESS
AUTH_SMTP_SENDER=$AUTH_SMTP_SENDER
AUTH_SMTP_CREDENTIALS_PARAMETER=$AUTH_SMTP_CREDENTIALS_PARAMETER
AUTH_WG_ADDRESS=$AUTH_WG_ADDRESS
AUTH_WG_PRIVATE_KEY_PARAMETER=$AUTH_WG_PRIVATE_KEY_PARAMETER
CC_DB_WG_ADDRESS=$CC_DB_WG_ADDRESS
CC_DB_WG_ENDPOINT=$CC_DB_WG_ENDPOINT
CC_DB_WG_PUBLIC_KEY=$CC_DB_WG_PUBLIC_KEY
DATA_WG_ADDRESS=$DATA_WG_ADDRESS
DATA_WG_ENDPOINT=$DATA_WG_ENDPOINT
DATA_WG_PUBLIC_KEY=$DATA_WG_PUBLIC_KEY
EOF
cp "$HERE/configure.sh" "$stage/"
mkdir "$stage/_jaia"
cp "$WEB/reset-elsewhere.html" "$WEB/support.css" "$WEB/logo.svg" "$stage/_jaia/"

install_and_run=$(cat <<'EOF'
set -e -u
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
tar -C "$tmp" -xzf -
sudo install -D -m 0755 "$tmp/configure.sh" /usr/local/sbin/jaia-auth-server-configure
sudo install -D -m 0644 "$tmp/auth-server.env" /etc/jaiabot/auth-server.env
sudo rm -rf /usr/local/share/jaia-auth-server/web/_jaia
sudo install -d -m 0755 /usr/local/share/jaia-auth-server/web/_jaia
sudo install -m 0644 "$tmp"/_jaia/* /usr/local/share/jaia-auth-server/web/_jaia/
sudo /usr/local/sbin/jaia-auth-server-configure
EOF
)

echo ">>>>>> Deploying to $host"
# The payload on stdin, the script as the remote command
tar -C "$stage" -czf - . | ssh $SSH_OPTS "jaia@$host" "$install_and_run"
