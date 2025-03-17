# even though the C++ code doesn't use this info, it still needs to generate it to compile correctly
set(NANOPB_PROTO /usr/lib/python3/dist-packages/proto/nanopb.proto)
configure_file(${NANOPB_PROTO} ${project_INC_DIR}/nanopb.proto COPYONLY)
protobuf_generate_cpp_full(NANOPB_PROTO_SRCS NANOPB_PROTO_HDRS "" ${project_INC_DIR} ${project_INC_DIR}/nanopb.proto)

set(SENSOR_MESSAGES
  sensor/pressure_temperature.proto
  sensor/salinity.proto
  sensor/sensor_core.proto
  sensor/configuration.proto
  sensor/metadata.proto
  sensor/catalog.proto
  sensor/atlas_scientific__ezo_ec.proto
  sensor/blue_robotics__bar30.proto
  sensor/atlas_scientific__ezo_do.proto
  sensor/atlas_scientific__ezo_ph.proto
  sensor/turner__c_fluor.proto
)

protobuf_generate_cpp_full(PROTO_SRCS PROTO_HDRS "jaiabot/messages" ${project_INC_DIR}
  example.proto
  geographic_coordinate.proto
  control_surfaces.proto
  high_control.proto
  control_surfaces.proto
  feather.proto
  lora_test.proto
  imu.proto
  mission.proto
  jaia_dccl.proto
  engineering.proto
  low_control.proto
  portal.proto
  metadata.proto
  moos.proto
  arduino.proto
  bounds.proto
  health.proto
  hub.proto
  dive_debug.proto
  xbee_extensions.proto
  modem_message_extensions.proto
  simulator.proto
  echo.proto
  tsys01.proto
  rest_api.proto
  option_extensions.proto
  motor.proto
  fleet_config.proto
  link.proto
  udp_driver.proto
  ${SENSOR_MESSAGES}
)

add_library(jaiabot_messages SHARED ${PROTO_SRCS} ${PROTO_HDRS} ${NANOPB_PROTO_SRCS} ${NANOPB_PROTO_HDRS})
target_link_libraries(jaiabot_messages ${PROTOBUF_LIBRARIES} goby)

project_install_lib(jaiabot_messages)

####
#Nanopb
###
configure_file(${NANOPB_PROTO} ${project_INC_DIR}/nanopb/nanopb.proto COPYONLY)
protobuf_include_dirs(${project_INC_DIR}/nanopb)

# we need to generate a nanopb version of these external messages as upstream doesn't provide a nanopb version
configure_file(${DCCL_INCLUDE_DIR}/dccl/option_extensions.proto ${project_INC_DIR}/nanopb/dccl/option_extensions.proto COPYONLY)
configure_file(${PROTOBUF_INCLUDE_DIRS}/google/protobuf/descriptor.proto ${project_INC_DIR}/nanopb/google/protobuf/descriptor.proto COPYONLY)

protobuf_generate_nanopb_c_full(DCCL_PROTO_C_SRCS DCCL_PROTO_C_HDRS "dccl" ${project_INC_DIR} option_extensions.proto)

protobuf_generate_nanopb_c_full(PROTO_C_SRCS PROTO_C_HDRS "jaiabot/messages" ${project_INC_DIR}
  arduino.proto
  feather.proto
  ${SENSOR_MESSAGES}
  )

add_library(jaiabot_messages_c SHARED
  ${NANOPB_PROTO_C_SRCS} ${NANOPB_PROTO_C_HDRS}
  ${GOOGLE_PROTO_C_SRCS} ${GOOGLE_PROTO_C_HDRS}
  ${DCCL_PROTO_C_SRCS} ${DCCL_PROTO_C_HDRS}
  ${PROTO_C_SRCS} ${PROTO_C_HDRS}
  )
target_link_libraries(jaiabot_messages_c nanopb::protobuf-nanopb-static)

# make sure we don't accidentally include C++ headers for generated protobufs when compiling with C by clearing and re-adding only desired include directories in the correct order (so nanopb generated headers come before others)
set_target_properties(jaiabot_messages_c PROPERTIES INCLUDE_DIRECTORIES "")
target_include_directories(jaiabot_messages_c
    PRIVATE ${project_INC_DIR}/nanopb
    PRIVATE ${project_INC_DIR}
)

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

  # When updating a DCCL message, just make sure to increment PROJECT_INTERVEHICLE_API_VERSION in jaiabot/cmake/JaiaVersions.cmake
  # and update the hash here (dccl -f src/lib/messages/jaia_dccl.proto -I build/amd64/include -I /usr/include -a -m jaiabot.protobuf.BotStatus -H)

  # When adding a new DCCL message (for intervehicle comms), make sure to add it to this list
  check_dccl_md5_hash("jaiabot.protobuf.BotStatus" "0x212994f9361861dc")
  check_dccl_md5_hash("jaiabot.protobuf.TaskPacket" "0xd6cdaf32db2fd089")
  check_dccl_md5_hash("jaiabot.protobuf.Command" "0xf4bad9b633f50b7f")
  check_dccl_md5_hash("jaiabot.protobuf.Engineering" "0x6694c32d91a8b1c7")
endif()
