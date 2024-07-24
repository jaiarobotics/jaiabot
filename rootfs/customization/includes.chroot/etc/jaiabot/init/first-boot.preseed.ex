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

########################################################
# SSH temp keys (to allow first boot to be run)
########################################################
jaia_do_add_authorized_keys=true
jaia_authorized_keys=$(cat << EOM
ssh-rsa AAAA_B64_KEY username
EOM
)

#########################################################
# Preseed jaiabot-embedded package debconf queries
# See jaiabot-embedded.templates from jaiabot-debian 
# https://github.com/jaiarobotics/jaiabot-debian/blob/1.y/jaiabot-embedded.templates
# To dump config in the correct format on a bot that is configured use: "debconf-get-selections  | grep jaia"
#########################################################
jaia_install_jaiabot_embedded=true
jaia_embedded_debconf=$(cat << EOM
jaiabot-embedded        jaiabot-embedded/warp   select 1
jaiabot-embedded        jaiabot-embedded/type   select bot
jaiabot-embedded        jaiabot-embedded/hub_id select 0
jaiabot-embedded        jaiabot-embedded/data_offload_ignore_type       select none
jaiabot-embedded        jaiabot-embedded/user_role      select user
jaiabot-embedded        jaiabot-embedded/bot_id select 0
jaiabot-embedded        jaiabot-embedded/imu_type       select bno085
jaiabot-embedded        jaiabot-embedded/bot_type       select hydro
jaiabot-embedded        jaiabot-embedded/fleet_id       select 0
jaiabot-embedded        jaiabot-embedded/led_type       select none
jaiabot-embedded        jaiabot-embedded/debconf_state_bot      select imu_install_type
jaiabot-embedded        jaiabot-embedded/mode   select runtime
jaiabot-embedded        jaiabot-embedded/debconf_state_hub      select
jaiabot-embedded        jaiabot-embedded/imu_install_type       select embedded
jaiabot-embedded        jaiabot-embedded/electronics_stack      select 2
jaiabot-embedded        jaiabot-embedded/n_bots select
jaiabot-embedded        jaiabot-embedded/arduino_type   select usb
jaiabot-embedded        jaiabot-embedded/debconf_state_common   select mode
EOM
)

jaia_reboot=true
