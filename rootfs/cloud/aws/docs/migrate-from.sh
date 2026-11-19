#!/bin/bash
# Copies the Let's Encrypt certificate and Apache HTTPS site from the docs server being replaced
# (CUTOVER_FROM_INSTANCE_ID) to a new one, so the new server serves HTTPS before the names move to it.
# certbot renews the copy on the new server once the names point there.
# Usage: migrate-from.sh docs/docs.conf NEW_SERVER_ADDRESS

set -u -e -o pipefail

if (( $# != 2 )); then
    echo "Usage: $0 docs/docs.conf NEW_SERVER_ADDRESS"
    exit 1
fi

SCRIPT_PATH=$(cd "$(dirname "$0")/.." && pwd)
set -a; source "$1"; set +a
export AWS_DEFAULT_REGION=${REGION:-us-west-2}
new=$2
SSH_OPTS=${SSH_OPTS:-}
ssh_to() { local host=$1; shift; ssh $SSH_OPTS -o StrictHostKeyChecking=accept-new "jaia@$host" "$@"; }

old=$(aws ec2 describe-instances --instance-ids "$CUTOVER_FROM_INSTANCE_ID" \
          --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
if [ "$old" = "$new" ]; then
    echo "$new is the server being replaced ($CUTOVER_FROM_INSTANCE_ID)" >&2
    exit 1
fi

echo ">>>>>> Waiting for cloud-init on $new"
ssh_to "$new" 'cloud-init status --wait > /dev/null; cloud-init status'
if ! ssh_to "$new" 'test -e /etc/jaiabot/docs-server-built'; then
    echo "$new was not built as a docs server by create_specialty_server.sh; not changing it" >&2
    exit 1
fi

sites="001-jaia-docs.conf 001-jaia-docs-le-ssl.conf"
echo ">>>>>> Copying /etc/letsencrypt and $sites from $old ($CUTOVER_FROM_INSTANCE_ID) to $new"
ssh_to "$old" "sudo tar -C /etc -czf - letsencrypt \$(printf 'apache2/sites-available/%s ' $sites)" |
    ssh_to "$new" "sudo tar -C /etc -xzf - --same-owner"

ssh_to "$new" "set -e
sudo a2enmod -q ssl rewrite
sudo a2ensite -q $sites
sudo apache2ctl configtest
sudo systemctl reload apache2
systemctl is-enabled certbot.timer
sudo certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry'"

echo ">>>>>> Checking $new"
"$SCRIPT_PATH/docs/check.sh" "$new"
