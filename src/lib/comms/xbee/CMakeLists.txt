jaiabot_protobuf_generate(LANGUAGE CXX
  PROTO_IMPORT_PREFIX "jaiabot/comms/xbee"
  TARGET_TYPE LIB
  OUT_VAR PROTOS_CPP
  PROTOS xbee.proto)

add_library(jaiabot_xbee SHARED
    xbee.cpp
    xbee_driver.cpp
    ${PROTOS_CPP})

project_install_lib(jaiabot_xbee)
  
target_link_libraries(jaiabot_xbee
  goby
  jaiabot_messages
)

add_jaiabot_application(TARGET xbee_driver_tester
  SOURCES main.cpp xbee.cpp xbee_driver.cpp driver_tester.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES jaiabot_xbee
  SKIP_INSTALL)
