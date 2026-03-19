add_jaiabot_library(TARGET jaiabot_moos_gateway_plugin
  SOURCES jaiabot_gateway_plugin.cpp
  PROTOS jaiabot_gateway_config.proto
  PROTO_IMPORT_PREFIX jaiabot/moos_gateway
  LINK_LIBRARIES goby goby_zeromq goby_moos jaiabot_messages)
