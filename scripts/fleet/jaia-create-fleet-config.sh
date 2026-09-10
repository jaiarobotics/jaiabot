#!/bin/bash
set -e -u

script_dir=$(dirname $0)
echo "script_dir: ${script_dir}"

# --binary=jaia admin fleet create
binary="$1"

if [[ ! "$#" = "2" || "$2" = "--help" || "$2" = "-h"  ]]; then
   echo "Usage: ${1#*=} fleet.cfg"
   exit 1;
fi

out="$2"

## Whiptail functions
# calculate the terminal size for whiptail (WT)
function calc_wt_size() {
  WT_HEIGHT=$(tput lines)
  WT_WIDTH=$(tput cols)
  WT_MENU_HEIGHT=$((${WT_HEIGHT} - 8))
}

# convert array of values into an array suitable for whiptail menu
function array_to_wt_menu() {
  local input=("$@")
  WT_ARRAY=()
  for i in "${!input[@]}"
  do
     WT_ARRAY+=("${input[$i]}")
     WT_ARRAY+=("")
  done
}

function array_to_wt_checklist() {
  local input=("$@")
  WT_ARRAY=()
  for i in "${!input[@]}"
  do
     WT_ARRAY+=("${input[$i]}")
     WT_ARRAY+=("")
     WT_ARRAY+=("0")
  done
}

# draw a GUI menu of options for the user using whiptail
# return choice in ${WT_CHOICE}
function run_wt_menu() {
    local title=$1
    local menu=$2
    shift 2
    local input=("$@")
    calc_wt_size
    array_to_wt_menu "${input[@]}"
    
    # insert stdout from the subshell directly in the controlling /dev/tty
    # so that we don't try to log any of the whiptail output
    WT_CHOICE=$(set -x; whiptail --title "$title" --menu "$menu" $WT_HEIGHT $WT_WIDTH $WT_MENU_HEIGHT "${WT_ARRAY[@]}" --output-fd 5 5>&1 1>/dev/tty)
    echo "User chose: $WT_CHOICE"
}

# draw a GUI menu of options for the user using whiptail
# return choice in ${WT_CHOICE}
function run_wt_checklist() {
    local title=$1
    local menu=$2
    shift 2
    local input=("$@")
    calc_wt_size
    array_to_wt_checklist "${input[@]}"
    
    # insert stdout from the subshell directly in the controlling /dev/tty
    # so that we don't try to log any of the whiptail output
    WT_CHOICE=$(set -x; whiptail --title "$title" --checklist "$menu" $WT_HEIGHT $WT_WIDTH $WT_MENU_HEIGHT "${WT_ARRAY[@]}" --output-fd 5 5>&1 1>/dev/tty)
    echo "User chose: $WT_CHOICE"
}

# draw a GUI menu for entering a text string
# return text in ${WT_TEXT}
function run_wt_inputbox() {
    local title=$1
    local text=$2
    calc_wt_size
    
    WT_TEXT=$(set -x; whiptail --title "$title" --inputbox "$text" $WT_HEIGHT $WT_WIDTH --output-fd 5 5>&1 1>/dev/tty)
    echo "User entered: ${WT_TEXT}"
}

# draw a GUI box asking the user a YES/NO
# question. Return 0 if YES, 1 if NO
function run_wt_yesno() {
    local title=$1
    local text=$2
    calc_wt_size
    if (set -x; whiptail --title "$title" --yesno "$text" $WT_HEIGHT $WT_WIDTH > /dev/tty); then
        echo "User chose YES"
        return 0
    else 
        echo "User chose NO"
        return 1
    fi
}

function run_wt_msg_box() {
    local title=$1
    local text=$2
    calc_wt_size
    (set -x; whiptail --title "$title" --msgbox "$text" $WT_HEIGHT $WT_WIDTH > /dev/tty)
}



script_dir=$(realpath `dirname $0`)
USING_PRESEED=false


echo "######################################################"
echo "## Choose Fleet                                     ##"
echo "######################################################"

FLEETS=($(seq 0 250))
run_wt_menu "Fleet Configuration" "Which fleet to create?" "${FLEETS[@]}"
[ $? -eq 0 ] || exit 1
FLEET_ID="$WT_CHOICE"

echo "######################################################"
echo "## Choose Hubs                                      ##"
echo "######################################################"

HUBS=($(seq 1 30))
run_wt_checklist "Fleet Configuration" "Which hubs are in the fleet?" "${HUBS[@]}"
[ $? -eq 0 ] || exit 1
HUB_IDS="$WT_CHOICE"



echo "######################################################"
echo "## Choose Bots                                      ##"
echo "######################################################"

BOTS=($(seq 1 150))
run_wt_checklist "Fleet Configuration" "Which bots are in the fleet?" "${BOTS[@]}"
[ $? -eq 0 ] || exit 1
BOT_IDS="$WT_CHOICE"

echo "fleet: ${FLEET_ID}" > $out
echo "hubs: [$(echo ${HUB_IDS[@]} | tr -d '"' | sed 's/ /,/g')]" >> $out
echo "bots: [$(echo ${BOT_IDS[@]} | tr -d '"' | sed 's/ /,/g')]" >> $out

echo "ssh {" >> $out


echo "######################################################"
echo "## Generating Hub SSH keys                          ##"
echo "######################################################"

HAS_CLOUDHUB=false
for HUB_ID_QUOTED in ${HUB_IDS}
do
    CLOUDHUB_ID=30
    HUB_ID=$(eval echo ${HUB_ID_QUOTED})
    KEYNAME="hub${HUB_ID}_fleet${FLEET_ID}"
    PRIVKEY="/tmp/${KEYNAME}"
    PUBKEY="${PRIVKEY}.pub"
    rm -f $PRIVKEY $PUBKEY


    if [[ "${HUB_ID}" = "${CLOUDHUB_ID}" ]]; then
        HAS_CLOUDHUB=true
        # Only generate a file based key pair for cloudhub
        ssh-keygen -f $PRIVKEY -t ed25519 -N "" -C "$KEYNAME"
        PRIVKEY_CONTENTS=$(awk '{print "\"" $0 "\\n\""}' ${PRIVKEY})
        PUBKEY_CONTENTS="\"$(cat ${PUBKEY})\""
    else
        # Otherwise require a yubikey
        run_wt_msg_box "Fleet Configuration" "Hub ${HUB_ID} SSH Private Key: Insert Hub ${HUB_ID} Yubikey to a USB port to generate SSH key and press OK when ready"

        num_yubikeys=$(ykman list -s | wc -l)
        while [[ "$num_yubikeys" != "1" ]]; do
            run_wt_msg_box "Fleet Configuration" "ERROR: Exactly one Yubikey needs to be inserted. Please check Yubikey for Hub ${HUB_ID} is correctly installed and no other Yubikeys are connected."
            num_yubikeys=$(ykman list -s | wc -l)
        done
        echo "Generated key using Yubikey $(ykman list -s)"
        ssh-keygen -t ed25519-sk -O no-touch-required -f $PRIVKEY -N "" -C hub${HUB_ID}_fleet${FLEET_ID}
        PRIVKEY_CONTENTS=$(awk '{print "\"" $0 "\\n\""}' ${PRIVKEY})
        PUBKEY_CONTENTS="\"no-touch-required $(cat ${PUBKEY})\""
    fi

    echo "  hub { id: ${HUB_ID} private_key: ${PRIVKEY_CONTENTS} public_key: ${PUBKEY_CONTENTS} }" >> $out
    rm $PRIVKEY $PUBKEY
done

echo "######################################################"
echo "## Generating service Wireguard VPN tmp key         ##"
echo "######################################################"

KEYNAME="id_vpn_tmp"
PRIVKEY="/tmp/${KEYNAME}"
PUBKEY="${PRIVKEY}.pub"
rm -f $PRIVKEY $PUBKEY
ssh-keygen -f $PRIVKEY -t ed25519 -N "" -C "$KEYNAME"
PRIVKEY_CONTENTS=$(awk '{print "\"" $0 "\\n\""}' ${PRIVKEY})    
PUBKEY_CONTENTS="\"$(cat ${PUBKEY})\""
echo "  vpn_tmp { private_key: ${PRIVKEY_CONTENTS} public_key: ${PUBKEY_CONTENTS} }" >> $out
rm $PRIVKEY $PUBKEY


echo "######################################################"
echo "## Set permanent SSH keys                           ##"
echo "## (for /home/jaia/.ssh/authorized_keys)            ##"
echo "######################################################"

while : ; do
run_wt_inputbox "Fleet Configuration" "Enter permanent SSH public key (for /home/jaia/.ssh/authorized_keys). Leave blank to continue"
PERM_PUBKEY=$WT_TEXT

if [ ! "${PERM_PUBKEY}" = "" ]; then
    echo "  permanent_authorized_keys: \"${PERM_PUBKEY}\"" >> $out
else
    break
fi

done

echo "}" >> $out # ssh {


echo "######################################################"
echo "## Choose Wifi password                             ##"
echo "######################################################"

run_wt_inputbox "Fleet Configuration" "Enter WIFI password"
WLAN_PASSWORD=$WT_TEXT
echo "wlan_password: \"${WLAN_PASSWORD}\"" >> $out

echo "######################################################"
echo "## Choose service Wireguard VPN state               ##"
echo "######################################################"

vpn_enabled="false"
run_wt_yesno "Fleet Configuration" "Should the service Wireguard VPN be enabled at boot?" && vpn_enabled="true"
echo "service_vpn_enabled: $vpn_enabled" >> $out

echo "######################################################"
echo "## Choose COMMON jaiabot-embedded settings          ##"
echo "## (may take a bit to prepare)                      ##"
echo "######################################################"


git_branch=$(cd ${script_dir}; git branch --show-current 2> /dev/null || true)
echo "git branch: ${git_branch}"
# if running in git, use the same rev
if [ ! "${git_branch}" = "" ]; then
    git_branch_cmd="-b ${git_branch}"
else
    # default to release branch
    git_branch_cmd=
    git_branch=default
fi

# docker requires lowercase tag names, hence the sed filter
debconf_image_name=jaia_fleet_debconf_$(echo ${git_branch} | sed 's|\(.*\)|\L\1|')
if [ "$(docker image ls ${debconf_image_name} --format='true')" != "true" ];
then
    echo "Building the docker ${debconf_image_name} image"
    docker build --no-cache -t ${debconf_image_name} -f - . <<EOF
FROM ubuntu:jammy
RUN apt-get update && apt-get install -y debconf-utils whiptail git
RUN cd / && git clone https://github.com/jaiarobotics/jaiabot.git ${git_branch_cmd}
EOF
fi

rf_encryption_password=$(head -c 16 /dev/urandom | xxd -p -c 16)


function run_debconf() {
    docker run -v /tmp:/tmp -it ${debconf_image_name} /bin/bash -c "
#!/bin/bash    

export DEBIAN_PRIORITY=low

cd /jaiabot
git pull

cat <<EOM | debconf-set-selections
unknown jaiabot-embedded/type select hub
unknown jaiabot-embedded/fleet_id select 0
unknown jaiabot-embedded/rf_encryption_password string ${rf_encryption_password}
unknown jaiabot-embedded/hub_id select 0
unknown jaiabot-embedded/mode select runtime
EOM

/jaiabot/debian/jaiabot-embedded.config

cat <<EOM | debconf-set-selections
unknown jaiabot-embedded/type select bot
unknown jaiabot-embedded/bot_id select 0
EOM

/jaiabot/debian/jaiabot-embedded.config

debconf-get-selections | grep jaiabot-embedded | sed 's/^unknown/jaiabot-embedded/' > /tmp/jaia-fleet-selections.txt"
}

function parse_debconf() {
    local input=$1
    local spaces=$2
    awk -v FS='\t' -v OFS='\t' '
BEGIN {
    # Print opening of the debconf entries
    printf ""
}
{
    # Skip lines containing keys to be excluded
    if ($2 ~ /\/(bot_id|hub_id|type|fleet_id|mode|debconf_state_common|debconf_state_hub|debconf_state_bot|warp)/) next;

    # Print debconf entry

    # Remove spaces from value
    gsub(" ", "", $4);

    printf "debconf {\n";
    printf "  key: \"%s\"\n", $2;
    printf "  type: %s\n", toupper($3);
    printf "  value: \"%s\"\n", $4;
    printf "}\n";
}' $input | sed "s/^/${spaces}/" >> $out
}

run_debconf 
parse_debconf /tmp/jaia-fleet-selections.txt ""

cp /tmp/jaia-fleet-selections.txt /tmp/jaia-common-fleet-selections.txt


echo "######################################################"
echo "## Set any OVERRIDES (different than COMMON)        ##"
echo "######################################################"

while : ; do
    run_wt_yesno "Fleet Configuration" "Do you have any additional bot/hub specific debconf overrides to specify?" || break


    run_wt_checklist "Fleet Configuration" "Which hubs are in this override set?" $(echo ${HUB_IDS[@]} | sed 's/"//g')
    [ $? -eq 0 ] || exit 1
    OVERRIDE_HUB_IDS="$WT_CHOICE"

    run_wt_checklist "Fleet Configuration" "Which bots are in this override set?" $(echo ${BOT_IDS[@]} | sed 's/"//g')
    [ $? -eq 0 ] || exit 1
    OVERRIDE_BOT_IDS="$WT_CHOICE"
    
    run_debconf

    # keep only lines that changed to reduce clutter in output
    comm -13 <(sort /tmp/jaia-common-fleet-selections.txt) <(sort /tmp/jaia-fleet-selections.txt) > /tmp/jaia-diff-fleet-selections.txt

    for HUB_ID_QUOTED in ${OVERRIDE_HUB_IDS}
    do
        HUB_ID=$(eval echo ${HUB_ID_QUOTED})
        echo "debconf_override {" >> $out
        echo "  type: HUB" >> $out
        echo "  id: ${HUB_ID}" >> $out
        parse_debconf /tmp/jaia-diff-fleet-selections.txt "  "
        echo "}" >> $out
    done

    for BOT_ID_QUOTED in ${OVERRIDE_BOT_IDS}
    do
        BOT_ID=$(eval echo ${BOT_ID_QUOTED})
        echo "debconf_override {" >> $out
        echo "  type: BOT" >> $out
        echo "  id: ${BOT_ID}" >> $out
        parse_debconf /tmp/jaia-diff-fleet-selections.txt "  "
        echo "}" >> $out
    done

done

echo "######################################################"
echo "## Communications Configuration                     ##"
echo "######################################################"

echo "comms {" >> $out

if grep -q iridium $out; then
    echo "######################################################"
    echo "## Iridium SBD Configuration                        ##"
    echo "######################################################"

    echo "  iridium_sbd {" >> $out
    for BOT_ID_QUOTED in ${BOT_IDS}
    do
        BOT_ID=$(eval echo ${BOT_ID_QUOTED})
        run_wt_inputbox "Fleet Configuration" "Enter Iridium IMEI for Bot ${BOT_ID}"
        IMEI=$WT_TEXT
        echo "    bot { id: $BOT_ID imei: \"$IMEI\" }" >> $out
    done

    SERVICE_TYPES=("SBD_DIRECTIP" "SBD_ROCKBLOCK")
    run_wt_menu "Fleet Configuration" "Which Iridium shore service does this fleet use (MetOcean is SBD_DIRECTIP)?" "${SERVICE_TYPES[@]}"
    [ $? -eq 0 ] || exit 1
    SERVICE_TYPE="$WT_CHOICE"

    echo "    sbd_type: $SERVICE_TYPE" >> $out
    
    if [[ "$SERVICE_TYPE" == "SBD_ROCKBLOCK" ]]; then
        run_wt_inputbox "Fleet Configuration" "Enter RockBLOCK portal username"
        ROCKBLOCK_USERNAME=$WT_TEXT

        run_wt_inputbox "Fleet Configuration" "Enter RockBLOCK portal password"
        ROCKBLOCK_PASSWORD=$WT_TEXT

        echo "    rockblock { username: \"$ROCKBLOCK_USERNAME\" password: \"$ROCKBLOCK_PASSWORD\" }" >> $out
    fi

    echo "  }" >> $out
fi

echo "}" >> $out

if $HAS_CLOUDHUB; then
    echo "######################################################"
    echo "## CloudHub Authentication configuration            ##"
    echo "######################################################"
    
    echo "cloudhub_auth {" >> $out
    BASE_URI="fleet${FLEET_ID}.jaia.tech"
    run_wt_inputbox "Fleet Configuration" "Enter CloudHub base URI (or leave blank for default of $BASE_URI)"
    if [ ! "${WT_TEXT}" = "" ]; then
        BASE_URI="$WT_TEXT"
    fi
    echo "  base_uri: \"$BASE_URI\"" >> $out
    run_wt_inputbox "Fleet Configuration" "Enter initial 'admin' user email"
    ADMIN_EMAIL=$WT_TEXT
    echo "  admin_email: \"$ADMIN_EMAIL\"" >> $out    

    run_wt_inputbox "Fleet Configuration" "Enter SMTP server address (e.g., smtp://smtp-relay.gmail.com:587)"
    SMTP_ADDRESS=$WT_TEXT
    echo "  smtp_address: \"$SMTP_ADDRESS\"" >> $out    

    echo "}" >> $out
fi

echo "######################################################"
echo "## Validate fleet configuration                     ##"
echo "######################################################"

jaia admin fleet validate -v $out

echo "######################################################"
echo "## Success                                          ##"
echo "######################################################"

echo "Output written to $out"
