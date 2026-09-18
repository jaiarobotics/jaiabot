#!/bin/bash

# Everything a CloudHub needs on its rootfs that the image does not carry: the tooling,
# the network and hostname, the offload mount, and cloud.env itself.
#
# First boot runs it, and so does the first boot after a major upgrade, which is why it
# discovers rather than remembers. None of this survives the rootfs swap and none of it
# needs to: the only CloudHub state that cannot be rebuilt is /etc/wireguard, whose
# private key every peer was issued against.
#
# The values AWS cannot be asked for come from the fleet config, by way of the seed that
# "jaia admin fleet generate --action write_cloudhub_env" writes.

usage() {
    cat <<EOF
Usage: $0 [options]

  --seed <path>    Values the fleet config supplies
                   (default: /boot/firmware/jaiabot/init/cloudhub_env.sh)
  --output <path>  Where to write (default: /etc/jaiabot/cloud.env)
  --dry-run        Write to stdout instead, and skip the ownership change
EOF
    exit 1
}

set -u -e -o pipefail

SEED=/boot/firmware/jaiabot/init/cloudhub_env.sh
OUTPUT=/etc/jaiabot/cloud.env
DRY_RUN=false

while (( $# > 0 )); do
    case "$1" in
        --seed) SEED="${2:-}"; shift 2 ;;
        --output) OUTPUT="${2:-}"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1" >&2; usage ;;
    esac
done

if [ ! -f "$SEED" ]; then
    echo "ERROR: no seed at $SEED; this machine is not a CloudHub, or 'jaia admin fleet generate --action write_cloudhub_env' has not run" >&2
    exit 1
fi

set -a
source "$SEED"
source /etc/jaiabot/jaia.env
set +a

for name in AUTH_BASE_URI AUTH_ADMIN_EMAIL AUTH_SMTP_ADDRESS CLOUDHUB_DATA_BUCKET; do
    if [ -z "${!name:-}" ]; then
        echo "ERROR: $SEED does not set $name" >&2
        exit 1
    fi
done

#############
## Tooling ##
#############

# The VirtualFleet playbooks need boto3; the discovery below needs the aws CLI
apt-get -y install python3-boto3

if ! command -v aws > /dev/null; then
    awscli_version=2.18.8
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    curl -sS "https://awscli.amazonaws.com/awscli-exe-linux-x86_64-${awscli_version}.zip" \
         -o "${tmp}/awscliv2.zip"
    unzip -q "${tmp}/awscliv2.zip" -d "$tmp"
    "${tmp}/aws/install"
fi

###############
## Discovery ##
###############

imds_token=$(curl -sS -m 5 -X PUT "http://169.254.169.254/latest/api/token" \
                  -H "X-aws-ec2-metadata-token-ttl-seconds: 120")

imds() {
    curl -sS -m 5 -H "X-aws-ec2-metadata-token: ${imds_token}" \
         "http://169.254.169.254/latest/$1"
}

region=$(imds meta-data/placement/region)
account_id=$(imds dynamic/instance-identity/document \
                 | sed -n 's/.*"accountId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

mac=$(imds meta-data/mac)
vpc_id=$(imds "meta-data/network/interfaces/macs/${mac}/vpc-id")
cloudhub_subnet_id=$(imds "meta-data/network/interfaces/macs/${mac}/subnet-id")
public_ipv4=$(imds meta-data/public-ipv4)

# The name every resource was tagged with, taken from the VPC rather than the fleet
# config: 'jaia admin fleet create_cloudhub' accepts a customer argument that overrides
# the config, and the tags are what it actually used
customer=$(aws ec2 describe-tags --region "$region" \
    --filters "Name=resource-id,Values=${vpc_id}" "Name=key,Values=jaia_customer" \
    --query 'Tags[0].Value' --output text)

# Both were tagged by create_vpc.sh; the VPC scopes the lookup to this fleet
vfleet_wlan_subnet_id=$(aws ec2 describe-subnets --region "$region" \
    --filters "Name=vpc-id,Values=${vpc_id}" \
              "Name=tag:Name,Values=jaia__Subnet_VirtualFleet_WLAN__${customer}" \
    --query 'Subnets[0].SubnetId' --output text)

vfleet_security_group=$(aws ec2 describe-security-groups --region "$region" \
    --filters "Name=vpc-id,Values=${vpc_id}" \
              "Name=tag:Name,Values=jaia__SecurityGroup_VirtualFleet__${customer}" \
    --query 'SecurityGroups[0].GroupId' --output text)

for pair in "vpc_id:${vpc_id}" "cloudhub_subnet_id:${cloudhub_subnet_id}" "customer:${customer}" \
            "vfleet_wlan_subnet_id:${vfleet_wlan_subnet_id}" \
            "vfleet_security_group:${vfleet_security_group}"; do
    if [ -z "${pair#*:}" ] || [ "${pair#*:}" = "None" ]; then
        echo "ERROR: could not discover ${pair%%:*}" >&2
        exit 1
    fi
done

# A VirtualFleet is raised from the AMI of whatever release this CloudHub is running,
# so after a major upgrade it follows the CloudHub rather than the release it came from
apt_path=$(sed -n 's|^deb .*packages\.jaia\.tech/ubuntu/\([^ ]*\)/ .*|\1|p' \
               /etc/apt/sources.list.d/jaiabot.list | grep -v '^gobysoft/' | head -1)
virtualfleet_repository=${apt_path%%/*}
virtualfleet_repository_version=${apt_path#*/}

# Preserved across a major upgrade with the rest of /etc/wireguard, so the peers that
# were issued against it keep working
cloudhub_wg_pubkey=$(wg pubkey < /etc/wireguard/privatekey)

###########
## Write ##
###########

contents=$(cat <<EOF
jaia_fleet_id=${jaia_fleet_id}
jaia_cloudhub_wg_pubkey=${cloudhub_wg_pubkey}
jaia_cloudhub_public_ipv4_address=${public_ipv4}
jaia_aws_vpc_id=${vpc_id}
jaia_aws_customer="${customer}"
jaia_aws_region=${region}
jaia_aws_cloudhub_subnet_id=${cloudhub_subnet_id}
jaia_aws_virtualfleet_wlan_subnet_id=${vfleet_wlan_subnet_id}
jaia_aws_account_id=${account_id}
jaia_aws_virtualfleet_security_group=${vfleet_security_group}
jaia_aws_virtualfleet_repository=${virtualfleet_repository}
jaia_aws_virtualfleet_repository_version=${virtualfleet_repository_version}
jaia_auth_base_uri=${AUTH_BASE_URI}
jaia_auth_admin_email=${AUTH_ADMIN_EMAIL}
jaia_auth_smtp_address=${AUTH_SMTP_ADDRESS}
EOF
)

if $DRY_RUN; then
    echo "$contents"
    exit 0
fi

# jaia_configure_authelia.sh appends its bootstrap marker here, so keep any line this
# file does not own rather than truncating the operator's additions
if [ -f "$OUTPUT" ]; then
    grep -v -E '^(jaia_fleet_id=|jaia_cloudhub_|jaia_aws_|jaia_auth_base_uri=|jaia_auth_admin_email=|jaia_auth_smtp_address=)' \
        "$OUTPUT" > "${OUTPUT}.keep" || true
else
    : > "${OUTPUT}.keep"
fi

{ echo "$contents"; cat "${OUTPUT}.keep"; } > "${OUTPUT}.new"
rm -f "${OUTPUT}.keep"
mv "${OUTPUT}.new" "$OUTPUT"
chown root:jaia "$OUTPUT"
chmod 640 "$OUTPUT"

echo "Wrote ${OUTPUT} for fleet ${jaia_fleet_id} in ${region}"

###################
## Machine setup ##
###################

cat <<EOF > /etc/network/interfaces
auto lo
iface lo inet loopback
auto eth0
iface eth0 inet dhcp
EOF

# jaiabot-embedded's postinst names the host once debconf carries a fleet and id. After a
# major upgrade that name is already set and nothing re-runs the postinst, so keep it.
if ! hostname | grep -qE '^(hub|bot)[0-9]+-fleet[0-9]+$'; then
    hostnamectl set-hostname "jaia-unnamed"
fi

# /etc/wireguard comes across a major upgrade but the unit enablement lives on the rootfs
# that is replaced, so without this the peers keep their keys and find nothing listening.
for conf in /etc/wireguard/wg_cloudhub.conf /etc/wireguard/wg_virtualfleet.conf; do
    [ -f "$conf" ] || continue
    unit="wg-quick@$(basename "$conf" .conf)"
    systemctl enable --now "$unit" || echo "WARNING: could not enable ${unit}"
done

offload_mount=/var/log/jaiabot/bot_offload/
if ! grep -q " ${offload_mount} " /etc/fstab; then
    cat <<EOF >> /etc/fstab
${CLOUDHUB_DATA_BUCKET} ${offload_mount} fuse.s3fs _netdev,allow_other,use_path_request_style,iam_role=auto,url=https://s3.${region}.amazonaws.com,dbglevel=warn,endpoint=${region} 0 0
EOF
fi

# fstab was read before this script wrote to it, so mount now rather than leaving the
# offload unavailable until the next boot
mkdir -p "${offload_mount}"
mountpoint -q "${offload_mount}" || mount "${offload_mount}" || echo "WARNING: could not mount ${offload_mount}"

# The CloudHub is internet-facing and always on, so unlike a bot it keeps taking
# security updates
cat <<EOF > /etc/apt/apt.conf.d/50unattended-upgrades
Unattended-Upgrade::Allowed-Origins {
    "\${distro_id}:\${distro_codename}-security";
};
Unattended-Upgrade::Package-Blacklist {
    "^linux-.*";
};
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
EOF
