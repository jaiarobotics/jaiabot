add_jaiabot_library(TARGET jaiabot_xbee
  SOURCES xbee.cpp xbee_driver.cpp
  PROTOS xbee.proto
  PROTO_IMPORT_PREFIX jaiabot/comms/xbee
  LINK_LIBRARIES goby jaiabot_messages)

add_jaiabot_application(TARGET xbee_driver_tester
  SOURCES main.cpp xbee.cpp xbee_driver.cpp driver_tester.cpp
  LINK_DEFAULT_LIBRARIES
  LINK_LIBRARIES jaiabot_xbee
  SKIP_INSTALL)
