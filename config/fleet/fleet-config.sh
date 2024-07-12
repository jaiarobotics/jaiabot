#!/bin/bash
set -e -u -x
# 
# This script configures an entire fleet from a machine with access
# to all the machines (i.e. with one of the master security keys installed)
#   ssh-keygen -t ed25519-sk -f master_yubikey{serial#} -N ""
#
# The script is re-entrant so you can reconfigure bots that were previously
# configured (potentially mixed with some that are not configured) and all should be OK.
# 
# The hub and bots need to be powered on and connected on the WIFI
# to the machine running this script (which could be the hub or one of the bots)
#

# This script can be automated using a "fleet-config.preseed" file with the environmental variable JAIA_FLEET_CONFIG_PRESEED set to its path, e.g.
#       JAIA_FLEET_CONFIG_PRESEED=/etc/jaiabot/fleet-config.preseed

# You can modify the SSH parameters using the environmental variable JAIA_FLEET_CONFIG_SSH_OPTS, e.g.
#       JAIA_FLEET_CONFIG_SSH_OPTS="-o StrictHostKeyChecking=no"

# For a real fleet, you must give the directory of the pre-generated Yubikeys as
#       JAIA_FLEET_CONFIG_YUBIKEYS_DIR=/path/to/fleet_config/ssh
#
# Where the keys are expected to be found at (privatekey) ${JAIA_FLEET_CONFIG_YUBIKEYS}/fleet0/hub1_fleet0 and (publickey) ${JAIA_FLEET_CONFIG_YUBIKEYS}/fleet0_yubikey/hub1_fleet0.pub
#
# These keys must be generated *once* using the actual host yubikey and the command
#   export FLEET_ID=6
#   export HUB_ID=1
#   ssh-keygen -t ed25519-sk -O no-touch-required -f /path/to/ssh/fleet${FLEET_ID}_yubikey/hub${HUB_ID}_fleet${FLEET_ID} -N "" -C hub${HUB_ID}_fleet${FLEET_ID}
#

# If running the Xbee Radio setup, you must provide the path to the directory with "fleetN/xbee.pb.cfg" or the file with JAIA_FLEET_CONFIG_XBEE_CFG, e.g., one of:
#       JAIA_FLEET_CONFIG_XBEE_CFG=/path/to/fleet_config
#       JAIA_FLEET_CONFIG_XBEE_CFG=/path/to/fleet0/xbee.pb.cfg 

script_dir=$(realpath `dirname $0`)
ansible_dir=$(realpath ${script_dir}/../ansible)

USING_PRESEED=false
if [[ ! -z "${JAIA_FLEET_CONFIG_PRESEED:-}" && -e "${JAIA_FLEET_CONFIG_PRESEED}" ]]; then
   USING_PRESEED=true
   source "${JAIA_FLEET_CONFIG_PRESEED}"
fi

source ${script_dir}/include/wt_tools.sh
source ${script_dir}/include/tasks.sh

echo "###############################################"
echo "###############################################"
echo "##### jaiabot fleet configuration script ######"
echo "###############################################"
echo "###############################################"

function hub_id_to_last_ip_octet()
{
    HUB_ID=$1; echo $((HUB_ID+10))
}
function bot_id_to_last_ip_octet()
{
    BOT_ID=$1; echo $((BOT_ID+100))
}

run_wt_yesno jaia_is_real_fleet "Real or Virtual fleet" "Is this a real fleet (as opposed to a VirtualFleet)?" && CONFIGURE_VIRTUALFLEET=false || CONFIGURE_VIRTUALFLEET=true

if [[ "${CONFIGURE_VIRTUALFLEET}" != "true" && -z "${JAIA_FLEET_CONFIG_YUBIKEYS_DIR:-}" ]]; then
    echo "You must set JAIA_FLEET_CONFIG_YUBIKEYS_DIR to configure a real fleet. Make sure you've sourced setup-fleet-config.sh"
    exit 1
fi 

function bot_ip()
{
    BOT_ID=$1;
    TYPE=${2:-"ssh"}
    BOT_IP="10.23.${FLEET_ID}.$(bot_id_to_last_ip_octet ${BOT_ID})"
    [[ "$CONFIGURE_VIRTUALFLEET" = "true" && "$TYPE" = "ssh" ]] && BOT_IP=bot${BOT_ID}-virtualfleet${FLEET_ID}
    echo "${BOT_IP}"
}
function hub_ip()
{
    HUB_ID=$1;
    TYPE=${2:-"ssh"}
    HUB_IP="10.23.${FLEET_ID}.$(hub_id_to_last_ip_octet ${HUB_ID})"
    [[ "$CONFIGURE_VIRTUALFLEET" = "true" && "$TYPE" = "ssh" ]] && HUB_IP=hub${HUB_ID}-virtualfleet${FLEET_ID}
    echo "${HUB_IP}"
}

function generate_temporary_ansible_inventory()
{
    local inv=${INVENTORY}
    echo "bots:" > ${inv}
    echo "  hosts:" >> ${inv}
    for id in $BOT_IDS; do
        id=${id//\"/} # Remove quotes
        ip=$(eval bot_ip ${id})
        echo "    bot${id}-fleet${FLEET_ID}:" >> ${inv}
        echo "      ansible_user: jaia" >> ${inv}
        echo "      ansible_host: ${ip}" >> ${inv}
    done
    echo "hubs:" >> ${inv}
    echo "  hosts:" >> ${inv}
    for id in $HUB_IDS; do
        id=${id//\"/} 
        ip=$(eval hub_ip ${id})
        echo "    hub${id}-fleet${FLEET_ID}:" >> ${inv}
        echo "      ansible_user: jaia" >> ${inv}
        echo "      ansible_host: ${ip}" >> ${inv}
    done
}


SSH="ssh ${JAIA_FLEET_CONFIG_SSH_OPTS:-}"
export ANSIBLE_HOST_KEY_CHECKING=False

# run commands on the read-only underlay as jaia (unprivileged user)
RO_CMD="sudo overlayroot-chroot sudo -u jaia "
RO_ROOT_CMD="sudo overlayroot-chroot "

FLEETS=($(seq 0 31))
run_wt_menu jaia_fleet_index "Fleet Configuration" "Which fleet to configure?" "${FLEETS[@]}"
[ $? -eq 0 ] || exit 1
FLEET_ID="$WT_CHOICE"

HUBS=($(seq 0 30))
run_wt_checklist jaia_hubs "Fleet Configuration" "Which hubs to configure?" "${HUBS[@]}"
[ $? -eq 0 ] || exit 1
HUB_IDS="$WT_CHOICE"

BOTS=($(seq 0 150))
run_wt_checklist jaia_bots "Fleet Configuration" "Which bots to configure?" "${BOTS[@]}"
[ $? -eq 0 ] || exit 1
BOT_IDS="$WT_CHOICE"

# write local temporary ansible playbook
INVENTORY=/tmp/jaia-fleet${FLEET_ID}-inventory-for-fleet-config.yml
generate_temporary_ansible_inventory
export ANSIBLE_FORCE_COLOR=true

function filter_output()
{
    # remove confusing output from overlayroot-chroot
    sed -e '\#^INFO: Chrooting\|mount: /media/root-ro: mount point is busy.\|ERROR: Note that \[/media/root-ro\] is still mounted read/write#d'
}

retrofit_ssh="Retrofit SSH config to support Yubikeys"
retrofit_ssh_preseed="retrofit-ssh"
setup_ssh_keys="Setup SSH Keys amongst fleet"
setup_ssh_keys_preseed="ssh-keys"
setup_wireguard="Setup Wireguard config and push to server"
setup_wireguard_preseed="wireguard-setup"
disable_wireguard="Disable auto-connection of Wireguard"
disable_wireguard_preseed="disable-wireguard"
copy_xbee="Copy XBee Radio Config"
copy_xbee_preseed="copy-xbee"
generate_ansible_inventory="Generate and write Ansible Inventory"
generate_ansible_inventory_preseed="ansible-inventory"
reboot="Reboot"
reboot_preseed="reboot"

run_wt_checklist jaia_actions "Action" "Choose the fleet config action(s)" "$retrofit_ssh" "$setup_ssh_keys" "$setup_wireguard" "$disable_wireguard" "$copy_xbee" "$generate_ansible_inventory" "$reboot"
[ $? -eq 0 ] || exit 1
actions="$WT_CHOICE"

IFS='"'
# Convert the string to an array
read -ra actions_arr <<< "$actions"
unset IFS

for i in "${!actions_arr[@]}"
do
    action="${actions_arr[i]}"
    [[ "${action}" == ' ' || -z "${action}" ]] && continue
    set -o pipefail
    case "$action" in
        # bots and hubs
        "$retrofit_ssh"|"$retrofit_ssh_preseed")
            retrofit_ssh |& filter_output
            ;;
        # bots and hubs
        "$setup_ssh_keys"|"$setup_ssh_keys_preseed")
            ssh_key_setup |& filter_output
            ;;
        # bots and hubs
        "$setup_wireguard"|"$setup_wireguard_preseed")
            wireguard_setup |& filter_output
            ;;
        # bots and hubs
        "$disable_wireguard"|"$disable_wireguard_preseed")
            wireguard_disable |& filter_output
            ;;
        # bots and hubs
        "$copy_xbee"|"$copy_xbee_preseed")
            xbee_radio_setup |& filter_output
            ;;
        # hubs only
        "$generate_ansible_inventory"|"$generate_ansible_inventory_preseed")
            gen_ansible_inventory |& filter_output
            ;;
        # bots and hubs
        "$reboot"|"$reboot_preseed")
            reboot |& filter_output
            ;;
        *)
            echo "Quitting"
            exit 1
            ;;
    esac
    set +o pipefail
done
