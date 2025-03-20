protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS ${CMAKE_CURRENT_BINARY_DIR} config.proto)

add_library(jaiabot_liaison_prelaunch SHARED jaiabot_liaison_load.cpp liaison_upgrade.cpp ${PROTO_SRCS} ${PROTO_HDRS})
target_link_libraries(jaiabot_liaison_prelaunch goby ${Boost_LIBRARIES} jaiabot_messages Wt::Wt)
target_compile_options(jaiabot_liaison_prelaunch PRIVATE -Wno-return-type-c-linkage)

configure_file(goby_liaison_prelaunch_jaiabot.in ${project_BIN_DIR}/goby_liaison_prelaunch_jaiabot @ONLY)

project_install_lib(jaiabot_liaison_prelaunch)

option(install_liaison_reboot_check "Install Liaison Reboot check to /var/www/html/reboot-check" ON)
if(install_motd)
  install(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/reboot-check DESTINATION /var/www/html)
endif()

set_property(TARGET jaiabot_liaison_prelaunch PROPERTY CXX_STANDARD 14)
