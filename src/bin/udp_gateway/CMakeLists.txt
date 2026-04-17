add_jaiabot_application(TARGET jaiabot_udp_gateway
  PROTOS config.proto
  SOURCES app.cpp
  LINK_DEFAULT_LIBRARIES)
