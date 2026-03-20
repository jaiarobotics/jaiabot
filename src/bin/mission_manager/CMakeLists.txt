set(APP jaiabot_mission_manager)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_executable(${APP}
  app.cpp
  mission_manager.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

target_link_libraries(${APP}
  goby
  goby_zeromq
  jaiabot_messages)

if(export_goby_interfaces)
  generate_interfaces(${APP})
endif()

if(build_state_diagrams)
  generate_state_diagram(${APP})
endif()

project_install_bin(${APP})
