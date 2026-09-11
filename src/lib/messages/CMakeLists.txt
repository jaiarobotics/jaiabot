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
)

# All messages used by microcontrollers (C code)
set(MCU_PROTOS
  ${SENSOR_PROTOS}
  arduino.proto
  feather.proto
)

# All messages for C++ and Python generation
set(JAIABOT_PROTOS
  ${MCU_PROTOS}
  example.proto
  geographic_coordinate.proto
  camera_driver.proto
  high_control.proto
  control_surfaces.proto
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
  pam.proto
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

# Fleet config contract: fleet_config.proto (with the debconf questions it declares) must
# match the committed snapshot for the version it declares, and the generated debconf
# templates/config must be current, so that a change existing fleet configs can't satisfy
# is caught here rather than during a major upgrade. See "Fleet configuration versioning"
# in src/doc/markdown/page091_major_upgrade.md
find_program(PYTHON3_EXECUTABLE python3 REQUIRED)
set(FLEET_CONFIG_TOOL ${project_SH_DIR}/fleet/jaia-fleet-config.py)
set(FLEET_CONFIG_CONTRACT_SCRIPT ${CMAKE_SOURCE_DIR}/scripts/build/fleet-config-contract.py)
set(FLEET_CONFIG_DEBCONF_SCRIPT ${CMAKE_SOURCE_DIR}/scripts/build/fleet-config-debconf-gen.py)
set(FLEET_CONFIG_CONTRACT_SNAPSHOT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/fleet_config/contract)
set(FLEET_CONFIG_SHARE_DIR ${project_SHARE_DIR}/jaiabot/fleet_config)
set(FLEET_CONFIG_DESCRIPTOR_SET ${FLEET_CONFIG_SHARE_DIR}/fleet_config.desc)
file(GLOB_RECURSE FLEET_CONFIG_CONTRACT_SNAPSHOTS ${FLEET_CONFIG_CONTRACT_SNAPSHOT_DIR}/v*/*)

# The schema the fleet config tool reads at runtime (no generated bindings needed)
add_custom_command(
  OUTPUT ${FLEET_CONFIG_DESCRIPTOR_SET}
  COMMAND ${CMAKE_COMMAND} -E make_directory ${FLEET_CONFIG_SHARE_DIR}
  COMMAND protobuf::protoc --descriptor_set_out=${FLEET_CONFIG_DESCRIPTOR_SET} --include_imports
          -I ${project_INC_DIR} jaiabot/messages/fleet_config.proto
  DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/fleet_config.proto ${CMAKE_CURRENT_SOURCE_DIR}/option_extensions.proto
  COMMENT "Generating fleet config descriptor set"
  VERBATIM
)

set(FLEET_CONFIG_CONTRACT_STAMP ${CMAKE_CURRENT_BINARY_DIR}/fleet_config_contract.stamp)
add_custom_command(
  OUTPUT ${FLEET_CONFIG_CONTRACT_STAMP}
  COMMAND ${PYTHON3_EXECUTABLE} ${FLEET_CONFIG_CONTRACT_SCRIPT}
          --proto ${CMAKE_CURRENT_SOURCE_DIR}/fleet_config.proto
          --templates ${CMAKE_SOURCE_DIR}/debian/jaiabot-embedded.templates
          -I ${project_INC_DIR} --protoc $<TARGET_FILE:protobuf::protoc>
          --snapshot-dir ${FLEET_CONFIG_CONTRACT_SNAPSHOT_DIR} check
  COMMAND ${PYTHON3_EXECUTABLE} ${FLEET_CONFIG_DEBCONF_SCRIPT}
          --descriptor-set ${FLEET_CONFIG_DESCRIPTOR_SET}
          --templates ${CMAKE_SOURCE_DIR}/debian/jaiabot-embedded.templates
          --config ${CMAKE_SOURCE_DIR}/debian/jaiabot-embedded.config --check
  COMMAND ${CMAKE_COMMAND} -E touch ${FLEET_CONFIG_CONTRACT_STAMP}
  DEPENDS ${FLEET_CONFIG_DESCRIPTOR_SET} ${CMAKE_CURRENT_SOURCE_DIR}/fleet_config.proto
          ${CMAKE_SOURCE_DIR}/debian/jaiabot-embedded.templates ${CMAKE_SOURCE_DIR}/debian/jaiabot-embedded.config
          ${FLEET_CONFIG_TOOL} ${FLEET_CONFIG_CONTRACT_SCRIPT} ${FLEET_CONFIG_DEBCONF_SCRIPT}
          ${FLEET_CONFIG_CONTRACT_SNAPSHOTS}
  COMMENT "Checking fleet config contract (version ${PROJECT_FLEET_CONFIG_VERSION}) and generated debconf files"
  VERBATIM
)

add_custom_target(fleet_config_contract ALL DEPENDS ${FLEET_CONFIG_CONTRACT_STAMP})

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
  check_dccl_md5_hash("jaiabot.protobuf.BotStatus" "0xb380068f487992ac")
  check_dccl_md5_hash("jaiabot.protobuf.TaskPacket" "0x870bcec1ecbe676f")
  check_dccl_md5_hash("jaiabot.protobuf.Command" "0x5118abed171402d6")
  check_dccl_md5_hash("jaiabot.protobuf.Engineering" "0x18098cf628e507ba")
  check_dccl_md5_hash("jaiabot.protobuf.Hub2HubData" "0xa4605600a16195bc")
endif()
