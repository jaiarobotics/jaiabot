set(APP jaia)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_executable(${APP} jaia_tool.cpp  ${PROTO_SRCS} ${PROTO_HDRS})

target_link_libraries(${APP}
  goby
  jaiabot_messages)

project_install_bin(${APP})
