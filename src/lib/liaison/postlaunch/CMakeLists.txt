protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_library(jaiabot_liaison SHARED jaiabot_liaison_load.cpp liaison_jaiabot.cpp ${PROTO_SRCS} ${PROTO_HDRS})
target_link_libraries(jaiabot_liaison goby goby_zeromq ${Boost_LIBRARIES} jaiabot_messages wt)

configure_file(goby_liaison_jaiabot.in ${project_BIN_DIR}/goby_liaison_jaiabot @ONLY)

if(export_goby_interfaces)
  generate_interfaces(jaiabot_liaison)
endif()

project_install_lib(jaiabot_liaison)
