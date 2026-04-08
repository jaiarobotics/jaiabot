add_jaiabot_library(TARGET jaiabot_moos_gateway_plugin
  SOURCES jaiabot_gateway_plugin.cpp
  PROTOS jaiabot/moos_gateway/jaiabot_gateway_config.proto
  LINK_LIBRARIES goby goby_zeromq goby_moos jaiabot_messages)
