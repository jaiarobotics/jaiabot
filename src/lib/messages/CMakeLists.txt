protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${project_INC_DIR}
  jaiabot/messages/example.proto
  jaiabot/messages/geographic_coordinate.proto
  jaiabot/messages/control_surfaces.proto
  jaiabot/messages/high_control.proto
  jaiabot/messages/control_surfaces.proto
  jaiabot/messages/feather.proto
  jaiabot/messages/lora_test.proto
  jaiabot/messages/pressure_temperature.proto
  jaiabot/messages/imu.proto
  jaiabot/messages/salinity.proto
  jaiabot/messages/mission.proto
  jaiabot/messages/jaia_dccl.proto
  jaiabot/messages/engineering.proto
  jaiabot/messages/low_control.proto
  jaiabot/messages/portal.proto
  jaiabot/messages/metadata.proto
  jaiabot/messages/moos.proto
  jaiabot/messages/arduino.proto
  jaiabot/messages/bounds.proto
  jaiabot/messages/health.proto
  jaiabot/messages/hub.proto
  jaiabot/messages/dive_debug.proto
  jaiabot/messages/xbee_extensions.proto
  jaiabot/messages/modem_message_extensions.proto
  )

add_library(jaiabot_messages SHARED ${PROTO_SRCS} ${PROTO_HDRS})
target_link_libraries(jaiabot_messages ${PROTOBUF_LIBRARIES} goby)

project_install_lib(jaiabot_messages)

protobuf_generate_nanopb_c(PROTO_C_SRCS PROTO_C_HDRS ${project_INC_DIR}
  jaiabot/messages/nanopb/arduino.proto
  jaiabot/messages/nanopb/feather.proto
  )

add_library(jaiabot_messages_c SHARED ${PROTO_C_SRCS} ${PROTO_C_HDRS})
target_link_libraries(jaiabot_messages_c protobuf-nanopb)

project_install_lib(jaiabot_messages_c)


function(check_dccl_md5_hash DCCL_NAME EXPECTED_MD5)
  add_custom_command(
        TARGET jaiabot_messages
        POST_BUILD
        COMMAND ${CMAKE_COMMAND}
        -D "DCCL_NAME=${DCCL_NAME}"
        -D "EXPECTED_MD5=${EXPECTED_MD5}"
        -D "MESSAGES_LIB_PATH=$<TARGET_FILE:jaiabot_messages>"
        -P "${CMAKE_SOURCE_DIR}/cmake/CheckDCCLMD5.cmake"
    )
endfunction()

# This list of all DCCL messages used on intervehicle comms with the latest MD5 hash of "dccl -p" is simply
# to ensure that CMake checks that we don't accidentally change the DCCL message without updating PROJECT_INTERVEHICLE_API_VERSION if necessary.
# We use "dccl -p" rather than hashing the file directly as this ensures whitespace, comments, and other non-functional changes
# do not affect the hash.

# When updating a DCCL message, just make sure to increment PROJECT_INTERVEHICLE_API_VERSION in jaiabot/CMakeLists.txt
# and update the hash here (dccl -l build/amd64/lib/libjaiabot_messages.so -p -m jaiabot.protobuf.BotStatus | md5sum)

# When adding a new DCCL message (for intervehicle comms), make sure to add it to this list
check_dccl_md5_hash("jaiabot.protobuf.BotStatus" "e0f630e3370090c39d82881dde0fefb4")
check_dccl_md5_hash("jaiabot.protobuf.TaskPacket" "bf034fed758aab4bbb33ad36f151f22c")
check_dccl_md5_hash("jaiabot.protobuf.Command" "1725ac018b858481cffd376319ac749a")
check_dccl_md5_hash("jaiabot.protobuf.CommandForHub" "6523ba68589b8738a1bc6ea43d1e6722")
check_dccl_md5_hash("jaiabot.protobuf.Engineering" "c52700c64f35fdf238453fac653ca799")
