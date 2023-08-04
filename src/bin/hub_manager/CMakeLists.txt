set(APP jaiabot_hub_manager)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_executable(${APP}
  hub_manager.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

target_link_libraries(${APP}
  goby
  goby_zeromq
  jaiabot_messages
  jaiabot_xbee
  )

if(export_goby_interfaces)
  generate_interfaces(${APP})
endif()

project_install_bin(${APP})
