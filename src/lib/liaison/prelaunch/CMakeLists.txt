add_jaiabot_library(TARGET jaiabot_liaison_prelaunch
  SOURCES jaiabot_liaison_load.cpp liaison_upgrade.cpp
  PRIVATE_PROTOS config.proto
  LINK_LIBRARIES goby ${Boost_LIBRARIES} jaiabot_messages Wt::Wt
  COMPILE_OPTIONS -Wno-return-type-c-linkage
  CXX_STANDARD 17)

configure_file(goby_liaison_prelaunch_jaiabot.in ${project_BIN_DIR}/goby_liaison_prelaunch_jaiabot @ONLY)

option(install_liaison_reboot_check "Install Liaison Reboot check to /var/www/html/reboot-check" ON)
if(install_motd)
  install(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/reboot-check DESTINATION /var/www/html)
endif()
