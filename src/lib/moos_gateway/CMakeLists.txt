set(LIB jaiabot_moos_gateway_plugin)
protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} jaiabot_gateway_config.proto)
add_library(${LIB} SHARED jaiabot_gateway_plugin.cpp ${PROTO_SRCS} ${PROTO_HDRS})
target_link_libraries(${LIB}
  goby goby_zeromq goby_moos jaiabot_messages)

if(export_goby_interfaces)
  generate_interfaces(${LIB})
endif()
project_install_lib(${LIB})
