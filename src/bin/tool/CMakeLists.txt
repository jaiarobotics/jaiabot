set(APP jaia)

protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR}
  config.proto
  actions/version.proto
  actions/ctl.proto
  actions/ssh.proto
  actions/ping.proto
  actions/net.proto
  actions/ip.proto
  actions/admin.proto
  actions/admin/ssh.proto
  actions/admin/ssh/add.proto
  actions/admin/ssh/rm.proto
  actions/admin/ssh/list.proto
  actions/admin/ssh/clear.proto
  )

add_executable(${APP}
  jaia_tool.cpp
  actions/version.cpp
  actions/ctl.cpp
  actions/ssh.cpp
  actions/ping.cpp
  actions/ip.cpp
  actions/admin.cpp
  actions/admin/ssh.cpp
  actions/admin/ssh/add.cpp
  actions/admin/ssh/rm.cpp
  actions/admin/ssh/pubkeys.cpp
  actions/admin/ssh/list.cpp
  actions/admin/ssh/clear.cpp
  ${PROTO_SRCS} ${PROTO_HDRS})

target_link_libraries(${APP}
  goby
  jaiabot_messages
  )

project_install_bin(${APP})
