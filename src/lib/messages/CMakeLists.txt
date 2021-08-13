protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${project_INC_DIR}
  jaiabot/messages/example.proto
  jaiabot/messages/low_control.proto
  jaiabot/messages/control_surfaces.proto
  jaiabot/messages/feather.proto
  jaiabot/messages/lora_test.proto
  jaiabot/messages/pt.proto
  jaiabot/messages/imu.proto
  jaiabot/messages/salinity.proto
  )

add_library(jaiabot_messages SHARED ${PROTO_SRCS} ${PROTO_HDRS})
target_link_libraries(jaiabot_messages ${PROTOBUF_LIBRARIES})

project_install_lib(jaiabot_messages)


protobuf_generate_nanopb_c(PROTO_C_SRCS PROTO_C_HDRS ${project_INC_DIR}
  jaiabot/messages/nanopb/control_surfaces.proto
  jaiabot/messages/nanopb/feather.proto
  )

add_library(jaiabot_messages_c SHARED ${PROTO_C_SRCS} ${PROTO_C_HDRS})
target_link_libraries(jaiabot_messages_c protobuf-nanopb)

project_install_lib(jaiabot_messages_c)
