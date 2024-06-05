# Preseed configuration. Booleans can be "true" or "yes"
# This is a bash script so any bash command is allowed
# Edit and rename to "/boot/firmware/jaiabot/init/first-boot.preseed" to take effect

jaia_run_first_boot=true
jaia_stress_tests=true

########################################################
# Network
########################################################
jaia_disable_ethernet=true
jaia_configure_wifi=true
jaia_wifi_ssid=dummy
jaia_wifi_password=dummy

#########################################################
# Preseed jaiabot-embedded package debconf queries
# See jaiabot-embedded.templates from jaiabot-debian 
# https://github.com/jaiarobotics/jaiabot-debian/blob/1.y/jaiabot-embedded.templates
# To dump config in the correct format on a bot that is configured use: "debconf-get-selections  | grep jaia"
#########################################################
jaia_install_jaiabot_embedded=true
jaia_embedded_debconf=$(cat << EOM
jaiabot-embedded	jaiabot-embedded/fleet_id	select	20
jaiabot-embedded	jaiabot-embedded/type	select	hub
jaiabot-embedded	jaiabot-embedded/mode	select	runtime
jaiabot-embedded	jaiabot-embedded/bot_id	select	0
jaiabot-embedded	jaiabot-embedded/hub_id	select	0
jaiabot-embedded	jaiabot-embedded/arduino_type	select	none
jaiabot-embedded	jaiabot-embedded/electronics_stack	select	2
jaiabot-embedded	jaiabot-embedded/led_type	select	none
jaiabot-embedded	jaiabot-embedded/imu_type	select	bno055
EOM
)

jaia_reboot=true
