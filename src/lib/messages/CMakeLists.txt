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
