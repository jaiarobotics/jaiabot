jaiabot_protobuf_generate(LANGUAGE CXX
  TARGET_TYPE BIN
  OUT_VAR PROTOS_CPP
  PROTOS config.proto)

add_library(jaiabot_liaison_prelaunch SHARED jaiabot_liaison_load.cpp liaison_upgrade.cpp ${PROTOS_CPP})
target_link_libraries(jaiabot_liaison_prelaunch goby ${Boost_LIBRARIES} jaiabot_messages Wt::Wt)
target_include_directories(jaiabot_liaison_prelaunch PRIVATE ${CMAKE_CURRENT_BINARY_DIR})
target_compile_options(jaiabot_liaison_prelaunch PRIVATE -Wno-return-type-c-linkage)

configure_file(goby_liaison_prelaunch_jaiabot.in ${project_BIN_DIR}/goby_liaison_prelaunch_jaiabot @ONLY)

project_install_lib(jaiabot_liaison_prelaunch)

option(install_liaison_reboot_check "Install Liaison Reboot check to /var/www/html/reboot-check" ON)
if(install_motd)
  install(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/reboot-check DESTINATION /var/www/html)
endif()

set_property(TARGET jaiabot_liaison_prelaunch PROPERTY CXX_STANDARD 17)