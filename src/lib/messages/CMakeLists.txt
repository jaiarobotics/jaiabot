# even though the C++ code doesn't use this info, it still needs to generate it to compile correctly

jaiabot_protobuf_make_symlinks(LINK NANOPB)

# Sensor messages
set(SENSOR_PROTOS
  sensor/pressure_temperature.proto
  sensor/salinity.proto
  sensor/sensor_core.proto
  sensor/configuration.proto
  sensor/metadata.proto
  sensor/catalog.proto
  sensor/atlas_scientific__oem_ec.proto
  sensor/blue_robotics__bar30.proto
  sensor/atlas_scientific__oem_do.proto
  sensor/atlas_scientific__oem_ph.proto
  sensor/turner__c_fluor.proto
  sensor/aml.proto
  sensor/tsys01.proto
)

set(POWER_BOARD_PROTOS
  power_board/actuators.proto
  power_board/metadata.proto
  power_board/power_board.proto
)

# All messages used by microcontrollers (C code)
set(MCU_PROTOS
  ${SENSOR_PROTOS}
  ${POWER_BOARD_PROTOS}
  arduino.proto
  feather.proto
  control_surfaces.proto
)

# All messages for C++ and Python generation
set(JAIABOT_PROTOS
  ${MCU_PROTOS}
  example.proto
  geographic_coordinate.proto
  camera_driver.proto
  high_control.proto
  imu.proto
  mission.proto
  jaia_dccl.proto
  engineering.proto
  low_control.proto
  portal.proto
  metadata.proto
  moos.proto
  bounds.proto
  health.proto
  hub.proto
  dive_debug.proto
  xbee_extensions.proto
  simulator.proto
  echo.proto
  tsys01.proto
  rest_api.proto
  option_extensions.proto
  motor.proto
  fleet_config.proto
  link.proto
  udp_driver.proto
  link_config.proto
  comms.proto
  ctd.proto
  udp_gateway.proto
  ppk.proto
)

list(TRANSFORM JAIABOT_PROTOS PREPEND "jaiabot/messages/")
list(TRANSFORM MCU_PROTOS PREPEND "jaiabot/messages/")

set(CXX_PROTOS ${JAIABOT_PROTOS}
  nanopb.proto)

add_jaiabot_library(TARGET jaiabot_messages
  TARGET_TYPE LIB
  OUT_VAR PROTOS_CPP
  PROTOS ${CXX_PROTOS}
  LINK_LIBRARIES protobuf::libprotobuf goby)

add_subdirectory(nanopb)
add_subdirectory(python)

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

  # When updating a DCCL message, just make sure to increment PROJECT_INTERVEHICLE_API_VERSION in jaiabot/cmake/JaiaVersions.cmake
  # and update the hash here (dccl -f src/lib/messages/jaia_dccl.proto -I build/amd64/include -I /usr/include -a -m jaiabot.protobuf.BotStatus -H)

  # When adding a new DCCL message (for intervehicle comms), make sure to add it to this list
  check_dccl_md5_hash("jaiabot.protobuf.BotStatus" "0x7e890f3ae52b514f")
  check_dccl_md5_hash("jaiabot.protobuf.TaskPacket" "0xc2b6ff5101df098c")
  check_dccl_md5_hash("jaiabot.protobuf.Command" "0x0f49a512d736e37c")
  check_dccl_md5_hash("jaiabot.protobuf.Engineering" "0x353435896a1ea1a0")
  check_dccl_md5_hash("jaiabot.protobuf.Hub2HubData" "0xc410eb3804ab6b83")

  endif()
