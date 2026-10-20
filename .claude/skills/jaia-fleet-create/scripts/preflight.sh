#!/bin/bash

# Checks that this workstation has what one part of the build needs, and nothing
# more: a part that does not touch AWS does not ask for it. Exits non-zero if
# anything would stop that part; warnings are printed but do not fail.
#
#   A (CloudHub):  --part A --fleet <id> --region <region> --repo <repo> [--base-uri <name>]
#   B (nodes):     --part B --config fleetN.cfg
#   C (pairing):   --part C --config fleetN.cfg

usage()
{
    cat <<EOF
Usage: $0 --part A --fleet <id> --region <region> --repo <repo> [--base-uri <name>]
       $0 --part B --config fleetN.cfg
       $0 --part C --config fleetN.cfg
EOF
    exit 2
}

PART="" FLEET="" REGION="" REPO="" BASE_URI="" CONFIG=""
while (( $# > 0 )); do
    case "$1" in
        --part) PART="$2"; shift 2 ;;
        --fleet) FLEET="$2"; shift 2 ;;
        --region) REGION="$2"; shift 2 ;;
        --repo) REPO="$2"; shift 2 ;;
        --base-uri) BASE_URI="$2"; shift 2 ;;
        --config) CONFIG="$2"; shift 2 ;;
        *) usage ;;
    esac
done

failures=0
ok() { echo "ok    $*"; }
warn() { echo "WARN  $*"; }
fail() { echo "FAIL  $*"; failures=$((failures + 1)); }

need()
{
    local tool
    for tool in "$@"; do
        command -v "$tool" >/dev/null || fail "'$tool' is not installed"
    done
}

# Read from the fleet config without printing it: it holds private keys
config_value()
{
    sed -n "s/^ *$1: *\"\{0,1\}\([^\"]*\)\"\{0,1\} *$/\1/p" "$CONFIG" | head -1
}

check_config()
{
    if [ -z "$CONFIG" ] || [ ! -r "$CONFIG" ]; then
        fail "no fleet config to read (--config fleetN.cfg); it is made in part A"
        return 1
    fi
    if ! out=$(jaia admin fleet validate "$CONFIG" 2>&1); then
        fail "fleet config does not validate: ${out##*$'\n'}"
        return 1
    fi
    ok "fleet config $CONFIG is valid"
    perms=$(stat -c %a "$CONFIG")
    [ "$perms" = 600 ] || warn "fleet config is mode $perms; it holds private keys: chmod 600 $CONFIG"
    FLEET=$(config_value fleet)
    BASE_URI=$(config_value base_uri)
    [ -n "$BASE_URI" ] || fail "fleet config has no CloudHub (cloudhub.base_uri): was it created with CloudHub yes?"
    # cloudhub create records the CloudHub's key in the config; nodes need it
    if awk '/hub *\{/{h=1} h&&/id: *30/{f=1} h&&/\}/{h=0} END{exit !f}' "$CONFIG"; then
        ok "fleet $FLEET, CloudHub $BASE_URI, made (its key is recorded in the config)"
    else
        fail "the config has no key for the CloudHub (hub 30): run part A's 'cloudhub create' with this config first"
    fi
}

check_tool()
{
    need jaia
    tool_version=$(jaia version 2>/dev/null | awk '/^jaiabot:/{getline; print $1; exit}')
    [ -n "$tool_version" ] && ok "jaia tool $tool_version ($(command -v jaia))" || fail "could not read the jaia tool's version"
}

case "$PART" in
    A)
        [ -n "$FLEET" ] && [ -n "$REGION" ] && [ -n "$REPO" ] || usage
        need aws git dig curl nc openssl ssh ssh-add
        check_tool

        top=$(git rev-parse --show-toplevel 2>/dev/null)
        if [ -z "$top" ] || [ ! -e "$top/rootfs/cloud/aws/create_vpc.sh" ]; then
            fail "not in a JaiaBot checkout: cloudhub create needs rootfs/cloud/aws from one"
        else
            ok "checkout $top at $(git -C "$top" describe --always --dirty)"
        fi

        if ! identity=$(aws sts get-caller-identity --query Arn --output text 2>&1); then
            fail "AWS is not reachable as you: ${identity##*$'\n'} (run 'aws login')"
        else
            ok "AWS as $identity"
            ami=$(aws ec2 describe-images --region "$REGION" --owners self \
                      --filters "Name=tag:jaiabot-rootfs-gen_repository,Values=$REPO" \
                                "Name=tag:jaiabot-rootfs-gen_repository_version,Values=3.y" \
                      --query 'sort_by(Images,&CreationDate)[-1].[ImageId,Tags[?Key==`jaiabot-rootfs-gen_version`]|[0].Value]' \
                      --output text 2>/dev/null)
            if [ -z "$ami" ] || [[ "$ami" == None* ]]; then
                fail "no $REPO/3.y AMI in $REGION for the CloudHub to boot"
            else
                read -r ami_id ami_version <<<"$ami"
                ok "CloudHub AMI $ami_id ($ami_version), the newest $REPO/3.y in $REGION"
                [ -n "$tool_version" ] && [ "${ami_version%%[~+]*}" != "${tool_version%%[~+]*}" ] \
                    && warn "the AMI ($ami_version) and the jaia tool ($tool_version) are different releases"
            fi

            aws ssm get-parameter --region "$REGION" --name /jaia/cloudhub/smtp_credentials \
                --query Parameter.Name --output text >/dev/null 2>&1 \
                && ok "SMTP credentials parameter /jaia/cloudhub/smtp_credentials exists in $REGION" \
                || warn "no /jaia/cloudhub/smtp_credentials in $REGION: password-reset email will not send unless the fleet config names another parameter or relay"

            vpcs=$(aws ec2 describe-vpcs --region "$REGION" --filters "Name=tag:jaia_fleet,Values=$FLEET" \
                       --query 'Vpcs[].VpcId' --output text 2>/dev/null)
            [ -z "$vpcs" ] && ok "fleet $FLEET has no VPC in $REGION" \
                || fail "fleet $FLEET already has a VPC in $REGION ($vpcs): delete it, or pick another fleet id"
        fi

        ssh-add -l >/dev/null 2>&1 && ok "ssh agent holds $(ssh-add -l | wc -l) key(s)" \
            || warn "the ssh agent holds no keys: cloudhub create waits for the CloudHub over SSH with your permanent key"
        if command -v ykman >/dev/null; then
            ykman list 2>/dev/null | grep -q . && ok "Yubikey present" \
                || warn "no Yubikey detected: 'fleet create' needs one per physical hub"
        else
            warn "ykman not installed: 'fleet create' uses it for each hub's key"
        fi
        if [ -n "$BASE_URI" ]; then
            existing=$(dig +short "$BASE_URI" A | tail -1)
            [ -z "$existing" ] && ok "$BASE_URI does not resolve yet" \
                || warn "$BASE_URI already resolves to $existing: if that is an old CloudHub, its records must be changed to the new address"
        fi
        ;;
    B)
        check_tool
        check_config || { echo; echo "1 check(s) failed"; exit 1; }
        config_version=$(config_value version)
        tool_config_version=$(jaia admin fleet version 2>/dev/null | grep -o '[0-9]\+' | tail -1)
        [ -n "$config_version" ] && [ "$config_version" = "$tool_config_version" ] \
            && ok "the jaia tool writes fleet config version $config_version, as this config is" \
            || warn "the config is version ${config_version:-?} and this jaia tool writes ${tool_config_version:-?}: generate boot files with the release the nodes will run"
        ;;
    C)
        need dig curl nc
        check_tool
        check_config || { echo; echo "1 check(s) failed"; exit 1; }
        if [ -n "$BASE_URI" ]; then
            address=$(dig +short "$BASE_URI" A | tail -1)
            [ -n "$address" ] && ok "$BASE_URI resolves to $address" || fail "$BASE_URI does not resolve: part A's DNS step is not finished"
            curl -sS -m 15 -o /dev/null "https://$BASE_URI/" 2>/dev/null && ok "https://$BASE_URI/ answers with a valid certificate" \
                || fail "https://$BASE_URI/ does not answer with a valid certificate (scripts/check_cloudhub.sh $BASE_URI)"
        fi
        hub=$(jaia_ip "h1f${FLEET}" 2>/dev/null)
        hub=${hub:-10.23.${FLEET}.11}
        if nc -z -w 3 "$hub" 80 2>/dev/null; then
            ok "hub 1's JCU answers at http://$hub/jcu/"
        else
            warn "hub 1 is not reachable at $hub: join fleet $FLEET's Wi-Fi (and power hub 1 on) to use its JCU and reach the nodes"
        fi
        ;;
    *) usage ;;
esac

echo
if (( failures > 0 )); then
    echo "$failures check(s) failed"
    exit 1
fi
echo "Ready for part $PART"
