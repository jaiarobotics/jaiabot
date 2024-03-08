# Preseed configuration. Booleans can be "true" or "yes"
# This is a bash script so any bash command is allowed
# Edit and rename to "fleet-config.preseed" to take effect

jaia_is_real_fleet=yes

jaia_fleet_index=3
# jaia_hubs='"1" "3"'
jaia_hubs='"1"'
# jaia_bots='"1" "2" "4"'
jaia_bots='"1"'

# "ssh-keys", "wireguard-setup", "disable-wireguard", "copy-xbee", "ansible-inventory", "reboot" in the order they should be executed
jaia_actions='"ssh-keys" "ansible-inventory" "reboot"'
