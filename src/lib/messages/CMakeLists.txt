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


if(NOT CMAKE_CROSSCOMPILING)
  # This list of all DCCL messages used on intervehicle comms with the latest MD5 hash of "dccl -a" is simply
  # to ensure that CMake checks that we don't accidentally change the DCCL message without updating PROJECT_INTERVEHICLE_API_VERSION if necessary.

  # When updating a DCCL message, just make sure to increment PROJECT_INTERVEHICLE_API_VERSION in jaiabot/CMakeLists.txt
  # and update the hash here (dccl -l build/amd64/lib/libjaiabot_messages.so -a -m jaiabot.protobuf.BotStatus | md5sum)

  # When adding a new DCCL message (for intervehicle comms), make sure to add it to this list
  check_dccl_md5_hash("jaiabot.protobuf.BotStatus" "6f7bbe0c3dea4d261f2cbb9b63ddc7ea")
  check_dccl_md5_hash("jaiabot.protobuf.TaskPacket" "c8b646292cf17c2dfb01cc345f1225c2")
  check_dccl_md5_hash("jaiabot.protobuf.Command" "2e7b4a319da87c4c88d77046577941d9")
  check_dccl_md5_hash("jaiabot.protobuf.Engineering" "c93eae42a168631b4a48f823294befe7")
endif()
