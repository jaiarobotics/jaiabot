# even though the C++ code doesn't use this info, it still needs to generate it to compile correctly
set(NANOPB_PROTO /usr/lib/python3/dist-packages/proto/nanopb.proto)
configure_file(${NANOPB_PROTO} ${CMAKE_CURRENT_SOURCE_DIR}/nanopb.proto COPYONLY)

jaiabot_protobuf_generate(LANGUAGE CXX
  TARGET_TYPE LIB
  OUT_VAR NANOPB_PROTOS_CPP
  PROTOS nanopb.proto)

set(SENSOR_MESSAGES
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
)

jaiabot_protobuf_generate(LANGUAGE CXX
  PROTO_IMPORT_PREFIX "jaiabot/messages"
  TARGET_TYPE LIB
  OUT_VAR PROTOS_CPP
  PROTOS
  example.proto
  geographic_coordinate.proto
  camera_driver.proto
  control_surfaces.proto
  high_control.proto
  control_surfaces.proto
  feather.proto
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
  ${SENSOR_MESSAGES})


add_jaiabot_library(TARGET jaiabot_messages
  SOURCES ${PROTOS_CPP} ${NANOPB_PROTOS_CPP}
  LINK_LIBRARIES protobuf::libprotobuf goby)

# ####
# #Nanopb
# ###
configure_file(${NANOPB_PROTO} ${project_INC_DIR}/nanopb/nanopb.proto COPYONLY)

# we need to generate a nanopb version of these external messages as upstream doesn't provide a nanopb version
configure_file(${DCCL_INCLUDE_DIR}/dccl/option_extensions.proto ${project_INC_DIR}/nanopb/dccl/option_extensions.proto COPYONLY)
configure_file(${PROTOBUF_INCLUDE_DIRS}/google/protobuf/descriptor.proto ${project_INC_DIR}/nanopb/google/protobuf/descriptor.proto COPYONLY)

jaiabot_protobuf_generate(LANGUAGE C
  PROTO_IMPORT_PREFIX "nanopb/dccl"
  TARGET_TYPE LIB
  IMPORT_DIRS ${project_INC_DIR}/nanopb
  OUT_VAR DCCL_PROTOS_C
  PROTOS option_extensions.proto
) 

jaiabot_protobuf_generate(LANGUAGE C
  PROTO_IMPORT_PREFIX "nanopb/jaiabot/messages"
  TARGET_TYPE LIB
  IMPORT_DIRS ${project_INC_DIR}/nanopb
  OUT_VAR PROTOS_C
  PROTOS arduino.proto
  feather.proto
  ${SENSOR_MESSAGES}
)

add_jaiabot_library(TARGET jaiabot_messages_c
  SOURCES ${DCCL_PROTOS_C} ${PROTOS_C}
  LINK_LIBRARIES nanopb::protobuf-nanopb-static)

# make sure we don't accidentally include C++ headers for generated protobufs when compiling with C by clearing and re-adding only desired include directories in the correct order (so nanopb generated headers come before others)
set_target_properties(jaiabot_messages_c PROPERTIES INCLUDE_DIRECTORIES "")
target_include_directories(jaiabot_messages_c
    PRIVATE ${project_INC_DIR}/nanopb
    PRIVATE ${project_INC_DIR}
)


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
  # TODO: Re-enable these hash checks once hashes are updated for DCCL5 compatibility
#  check_dccl_md5_hash("jaiabot.protobuf.BotStatus" "0x62932a2478675986")
#  check_dccl_md5_hash("jaiabot.protobuf.TaskPacket" "0x02ceabe2c978aad4")
#  check_dccl_md5_hash("jaiabot.protobuf.Command" "0x14ebbe8ed8aed722")
#  check_dccl_md5_hash("jaiabot.protobuf.Engineering" "0x6694c32d91a8b1c7")
endif()
