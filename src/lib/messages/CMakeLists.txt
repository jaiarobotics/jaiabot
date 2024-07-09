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
  jaiabot/messages/simulator.proto
  jaiabot/messages/echo.proto
  jaiabot/messages/rest_api.proto
  )

add_library(jaiabot_messages SHARED ${PROTO_SRCS} ${PROTO_HDRS})
target_link_libraries(jaiabot_messages ${PROTOBUF_LIBRARIES} goby)

project_install_lib(jaiabot_messages)

protobuf_generate_nanopb_c(PROTO_C_SRCS PROTO_C_HDRS ${project_INC_DIR}
  jaiabot/messages/nanopb/arduino.proto
  jaiabot/messages/nanopb/feather.proto
  )

add_library(jaiabot_messages_c SHARED ${PROTO_C_SRCS} ${PROTO_C_HDRS})
target_link_libraries(jaiabot_messages_c nanopb::protobuf-nanopb-static)

project_install_lib(jaiabot_messages_c)


function(check_dccl_md5_hash DCCL_NAME EXPECTED_HASH)
  add_custom_command(
        TARGET jaiabot_messages
        POST_BUILD
        COMMAND ${CMAKE_COMMAND}
        -D "DCCL_NAME=${DCCL_NAME}"
        -D "EXPECTED_HASH=${EXPECTED_HASH}"
        -D "MESSAGES_LIB_PATH=$<TARGET_FILE:jaiabot_messages>"
        -P "${CMAKE_SOURCE_DIR}/cmake/CheckDCCLHASH.cmake"
    )
endfunction()


if(NOT CMAKE_CROSSCOMPILING)
  # This list of all DCCL messages used on intervehicle comms with the latest hash ("dccl -a -H") is simply
  # to ensure that CMake checks that we don't accidentally change the DCCL message without updating PROJECT_INTERVEHICLE_API_VERSION if necessary.

  # When updating a DCCL message, just make sure to increment PROJECT_INTERVEHICLE_API_VERSION in jaiabot/CMakeLists.txt
  # and update the hash here (dccl -f src/lib/messages/jaia_dccl.proto -I build/amd64/include -I /usr/include -a -m jaiabot.protobuf.BotStatus -H)

  # When adding a new DCCL message (for intervehicle comms), make sure to add it to this list
  check_dccl_md5_hash("jaiabot.protobuf.BotStatus" "0xd3f1756c210c6df8")
  check_dccl_md5_hash("jaiabot.protobuf.TaskPacket" "0x72e30e5222062eee")
  check_dccl_md5_hash("jaiabot.protobuf.Command" "0x52a2f5523b658a63")
  check_dccl_md5_hash("jaiabot.protobuf.Engineering" "0x6694c32d91a8b1c7")
endif()
